import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Image,
    Switch,
    ActivityIndicator,
    ScrollView,
    Platform,
    LogBox
} from 'react-native';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import * as ImagePicker from 'expo-image-picker';

// Silenciar avisos do Expo Go no terminal
LogBox.ignoreLogs([
    'expo-notifications: Android Push notifications',
    'Android Push notifications (remote notifications)',
]);

// Carregamento Seguro do expo-notifications (Simulador para o Expo Go no SDK 53+)
let Notifications: any = {
    setNotificationHandler: () => { },
    setNotificationChannelAsync: async () => { },
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    scheduleNotificationAsync: async () => {
        console.log('[Expo Go] Notificação simulada com sucesso!');
    },
    AndroidImportance: { MAX: 5 },
    SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
};

try {
    // Tenta carregar o módulo nativo; se estiver no Expo Go Android (SDK 53+), captura o erro sem fechar a app
    const nativeNotifications = require('expo-notifications');
    if (nativeNotifications && Object.keys(nativeNotifications).length > 0) {
        Notifications = nativeNotifications;
    }
} catch (e) {
    console.warn('expo-notifications desativado no Expo Go. A utilizar modo de simulação.');
}

// Configuração Global de Notificação em Primeiro Plano
try {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
} catch (e) {
    // Ignora o erro no Expo Go
}

// 1. INTERFACE DE DADOS DO DIÁRIO DE MANUTENÇÃO
interface Manutencao {
    id: number;
    modelo: string;
    placa: string;
    quilometragem: number;
    descricao_modificacao: string;
    latitude_oficina: number;
    longitude_oficina: number;
    status_direcao: string;
    imagem_uri: string | null;
    data_hora: string;
    status: string; // 'Pendente' ou 'Concluído'
}

// Chaves de preferência do AsyncStorage
const STORAGE_THEME_KEY = '@carlog:theme_preference';
const STORAGE_USER_KEY = '@carlog:driver_name';

export default function App() {
    const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
    const [historico, setHistorico] = useState<Manutencao[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // ESTADOS DO FORMULÁRIO (Alinhados com o Diário de Modificações)
    const [nomeMotorista, setNomeMotorista] = useState<string>('Motorista');
    const [modelo, setModelo] = useState('');
    const [placa, setPlaca] = useState('');
    const [quilometragem, setQuilometragem] = useState('');
    const [descricaoModificacao, setDescricaoModificacao] = useState('');
    const [imagemUri, setImagemUri] = useState<string | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(false);

    // ESTADOS DOS SENSORES (GPS Oficina + Acelerômetro de Impacto)
    const [locationOficina, setLocationOficina] = useState<Location.LocationObject | null>(null);
    const [diagnosticoDirecao, setDiagnosticoDirecao] = useState<string>('A analisar estabilidade...');

    useEffect(() => {
        async function initApp() {
            try {
                // A. Carregar preferências do utilizador (AsyncStorage)
                const savedTheme = await AsyncStorage.getItem(STORAGE_THEME_KEY);
                if (savedTheme !== null) setIsDarkMode(savedTheme === 'dark');

                const savedUser = await AsyncStorage.getItem(STORAGE_USER_KEY);
                if (savedUser !== null) setNomeMotorista(savedUser);

                // B. Inicializar canais de notificação local
                try {
                    if (Platform.OS === 'android') {
                        await Notifications.setNotificationChannelAsync('default', {
                            name: 'Alertas CarLog',
                            importance: Notifications.AndroidImportance.MAX,
                        });
                    }
                    await Notifications.requestPermissionsAsync();
                } catch (notifErr) {
                    console.warn('Aviso: Notificações ignoradas no Expo Go.');
                }

                // C. Inicializar Banco de Dados SQLite
                const database = await SQLite.openDatabaseAsync('carlog_oficina.db');
                setDb(database);

                await database.execAsync(`
          CREATE TABLE IF NOT EXISTS manutencoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            modelo TEXT NOT NULL,
            placa TEXT NOT NULL,
            quilometragem INTEGER NOT NULL,
            descricao_modificacao TEXT NOT NULL,
            latitude_oficina REAL NOT NULL,
            longitude_oficina REAL NOT NULL,
            status_direcao TEXT NOT NULL,
            imagem_uri TEXT,
            data_hora TEXT NOT NULL,
            status TEXT NOT NULL
          );
        `);

                // D. Ativar sensores nativos
                await obterLocalizacaoOficina();
                iniciarMonitorEstabilidade();

                // E. Carregar Histórico do Banco
                await carregarHistorico(database);
            } catch (error) {
                console.error("Erro ao inicializar a aplicação:", error);
                Alert.alert("Erro", "Falha ao carregar o banco SQLite ou sensores.");
            } finally {
                setLoading(false);
            }
        }

        initApp();
    }, []);

    // 2. REGRA DO GPS: CAPTURAR LOCALIZAÇÃO DA OFICINA MECÂNICA
    async function obterLocalizacaoOficina() {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Aviso', 'Permissão de GPS negada. Não será possível mapear a oficina.');
            return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        setLocationOficina(loc);
    }

    // 3. REGRA DO ACELERÔMETRO: DETECTOR DE IMPACTO / PISTA IRREGULAR
    function iniciarMonitorEstabilidade() {
        Accelerometer.setUpdateInterval(500);
        Accelerometer.addListener((data) => {
            // Fórmula de Magnitude Vetorial exigida pela rubrica do SENAI
            const mag = Math.sqrt(data.x * data.x + data.y * data.y + data.z * data.z);
            if (mag > 1.6) {
                setDiagnosticoDirecao('⚠️ Impacto Brusco / Pista Irregular');
            } else {
                setDiagnosticoDirecao('🎯 Condução Segura');
            }
        });
    }

    // 4. REGRA DA CÂMERA: FOTOGRAFAR REPARO OU ODÔMETRO
    async function tirarFotoRegistro() {
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.5,
        });
        if (!result.canceled) {
            setImagemUri(result.assets[0].uri);
        }
    }

    // 5. MUDANÇA DE TEMA (LIGHT / DARK)
    async function toggleTheme(val: boolean) {
        setIsDarkMode(val);
        try {
            await AsyncStorage.setItem(STORAGE_THEME_KEY, val ? 'dark' : 'light');
        } catch (e) {
            console.error(e);
        }
    }

    // 6. SQLITE - SELECT (CARREGAR LISTA)
    async function carregarHistorico(databaseInstance?: SQLite.SQLiteDatabase) {
        const activeDb = databaseInstance || db;
        if (!activeDb) return;
        try {
            const rows = await activeDb.getAllAsync<Manutencao>('SELECT * FROM manutencoes ORDER BY id DESC;');
            setHistorico(rows);
        } catch (e) {
            console.error(e);
        }
    }

    // 7. SQLITE - INSERT (GUARDAR REGISTO COM COORDENADAS DA OFICINA)
    async function handleSalvarRegistro() {
        if (!modelo.trim() || !placa.trim() || !quilometragem.trim() || !descricaoModificacao.trim()) {
            Alert.alert('Aviso', 'Preencha todos os campos da modificação.');
            return;
        }
        if (!locationOficina) {
            Alert.alert('Aviso', 'A aguardar sinal do GPS para localizar a oficina...');
            await obterLocalizacaoOficina();
            return;
        }
        if (!db) return;

        try {
            const dataHora = new Date().toLocaleString('pt-PT');
            const kmAtual = parseInt(quilometragem, 10) || 0;

            await db.runAsync(
                `INSERT INTO manutencoes 
        (modelo, placa, quilometragem, descricao_modificacao, latitude_oficina, longitude_oficina, status_direcao, imagem_uri, data_hora, status) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                [
                    modelo.trim(),
                    placa.trim(),
                    kmAtual,
                    descricaoModificacao.trim(),
                    locationOficina.coords.latitude,
                    locationOficina.coords.longitude,
                    diagnosticoDirecao,
                    imagemUri,
                    dataHora,
                    'Pendente'
                ]
            );

            // Disparar Notificação Local
            try {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: "🔧 Diário Atualizado — CarLog",
                        body: `Modificação no ${modelo.trim()} registrada na oficina com sucesso!`,
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                        seconds: 5,
                        channelId: 'default',
                    },
                });
            } catch (notifErr) {
                console.log('Notificação local ignorada no ambiente Expo Go.');
            }

            Alert.alert('Sucesso', 'Registo guardado com as coordenadas da oficina!');

            // Limpar formulário
            setModelo('');
            setPlaca('');
            setQuilometragem('');
            setDescricaoModificacao('');
            setImagemUri(null);
            await carregarHistorico();
        } catch (e) {
            console.error("Erro ao guardar no SQLite:", e);
            Alert.alert('Erro', 'Falha ao gravar modificação no banco de dados.');
        }
    }

    // 8. SQLITE - UPDATE (CONCLUIR / REABRIR MANUTENÇÃO)
    async function handleToggleStatus(item: Manutencao) {
        if (!db) return;
        const novoStatus = item.status === 'Pendente' ? 'Concluído' : 'Pendente';
        try {
            await db.runAsync('UPDATE manutencoes SET status = ? WHERE id = ?;', [novoStatus, item.id]);
            await carregarHistorico();
        } catch (e) {
            console.error(e);
        }
    }

    // 9. SQLITE - DELETE (ELIMINAR REGISTO)
    async function handleDeletar(id: number) {
        if (!db) return;
        try {
            await db.runAsync('DELETE FROM manutencoes WHERE id = ?;', [id]);
            await carregarHistorico();
        } catch (e) {
            console.error(e);
        }
    }

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#2563EB" />
                <Text style={{ marginTop: 10 }}>A carregar Diário CarLog (SQLite)...</Text>
            </View>
        );
    }

    const activeTheme = isDarkMode ? darkTheme : lightTheme;

    return (
        <ScrollView contentContainerStyle={[styles.container, activeTheme.container]}>

            {/* CABEÇALHO */}
            <View style={styles.headerRow}>
                <View>
                    <Text style={[styles.title, activeTheme.text]}>CarLog 🏎️</Text>
                    <Text style={activeTheme.subText}>Diário de {nomeMotorista}</Text>
                </View>
                <View style={styles.themeToggle}>
                    <Text style={activeTheme.subText}>{isDarkMode ? 'Dark' : 'Light'}</Text>
                    <Switch value={isDarkMode} onValueChange={toggleTheme} />
                </View>
            </View>

            {/* CARD DE MONITORIZAÇÃO DE HARDWARE */}
            <View style={[styles.card, activeTheme.card]}>
                <Text style={[styles.cardTitle, activeTheme.text]}>📡 Monitor de Sensores</Text>
                <Text style={activeTheme.subText}>
                    📍 Oficina: {locationOficina ? `${locationOficina.coords.latitude.toFixed(4)}, ${locationOficina.coords.longitude.toFixed(4)}` : 'A procurar GPS...'}
                </Text>
                <Text style={activeTheme.subText}>{diagnosticoDirecao}</Text>
            </View>

            {/* FORMULÁRIO */}
            <View style={[styles.card, activeTheme.card]}>
                <Text style={[styles.cardTitle, activeTheme.text]}>📝 Nova Modificação / Manutenção</Text>

                <TextInput
                    style={[styles.input, activeTheme.input]}
                    placeholder="Modelo do Veículo (ex: Golf GTI)"
                    placeholderTextColor="#94A3B8"
                    value={modelo}
                    onChangeText={setModelo}
                />

                <TextInput
                    style={[styles.input, activeTheme.input]}
                    placeholder="Matrícula do Carro (ex: BRA2E19)"
                    placeholderTextColor="#94A3B8"
                    value={placa}
                    onChangeText={setPlaca}
                />

                <TextInput
                    style={[styles.input, activeTheme.input]}
                    placeholder="Quilometragem Atual (ex: 62000)"
                    keyboardType="numeric"
                    placeholderTextColor="#94A3B8"
                    value={quilometragem}
                    onChangeText={setQuilometragem}
                />

                <TextInput
                    style={[styles.input, activeTheme.input]}
                    placeholder="Descrição (ex: Troca de Amortecedor / Remap)"
                    placeholderTextColor="#94A3B8"
                    value={descricaoModificacao}
                    onChangeText={setDescricaoModificacao}
                />

                <TouchableOpacity style={styles.btnCamera} onPress={tirarFotoRegistro}>
                    <Text style={styles.btnText}>
                        {imagemUri ? '📷 Foto Anexada (Alterar)' : '📷 Fotografar Peça / Odómero'}
                    </Text>
                </TouchableOpacity>

                {imagemUri && <Image source={{ uri: imagemUri }} style={styles.preview} />}

                <TouchableOpacity style={styles.btnSave} onPress={handleSalvarRegistro}>
                    <Text style={styles.btnText}>💾 Guardar Registo no SQLite</Text>
                </TouchableOpacity>
            </View>

            {/* HISTÓRICO */}
            <Text style={[styles.sectionTitle, activeTheme.text]}>Histórico de Modificações ({historico.length})</Text>

            {historico.map((item) => (
                <View key={item.id} style={[styles.itemRow, activeTheme.card]}>
                    {item.imagem_uri && <Image source={{ uri: item.imagem_uri }} style={styles.thumb} />}

                    <View style={{ flex: 1, marginLeft: item.imagem_uri ? 10 : 0 }}>
                        <Text style={[styles.itemTitle, activeTheme.text]}>{item.modelo} — {item.placa}</Text>
                        <Text style={activeTheme.subText}>🔧 {item.descricao_modificacao} ({item.quilometragem} KM)</Text>
                        <Text style={activeTheme.subText}>📍 Oficina: {item.latitude_oficina.toFixed(4)}, {item.longitude_oficina.toFixed(4)}</Text>
                        <Text style={activeTheme.subText}>📈 Impacto registrado: {item.status_direcao}</Text>
                        <Text style={activeTheme.subText}>📅 {item.data_hora} | Status: {item.status}</Text>
                    </View>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btnAction, item.status === 'Pendente' ? styles.btnDone : styles.btnActive]}
                            onPress={() => handleToggleStatus(item)}
                        >
                            <Text style={styles.btnActionText}>{item.status === 'Pendente' ? 'Concluir' : 'Reabrir'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.btnDelete} onPress={() => handleDeletar(item.id)}>
                            <Text style={styles.btnActionText}>Eliminar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    container: {
        padding: 20,
        paddingTop: 50
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold'
    },
    themeToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    card: {
        padding: 14,
        borderRadius: 10,
        marginBottom: 15
    },
    cardTitle: {
        fontWeight: 'bold',
        marginBottom: 10,
        fontSize: 16
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        marginBottom: 10
    },
    btnCamera: {
        backgroundColor: '#475569',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 10
    },
    btnSave: {
        backgroundColor: '#16A34A',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 5
    },
    btnText: {
        color: '#FFFFFF',
        fontWeight: 'bold'
    },
    preview: {
        width: '100%',
        height: 140,
        borderRadius: 8,
        marginBottom: 10
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10
    },
    itemRow: {
        flexDirection: 'row',
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
        alignItems: 'center'
    },
    thumb: {
        width: 60,
        height: 60,
        borderRadius: 6
    },
    itemTitle: {
        fontWeight: 'bold',
        fontSize: 15
    },
    actions: {
        gap: 4,
        marginLeft: 10
    },
    btnAction: {
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderRadius: 4,
        alignItems: 'center'
    },
    btnDone: {
        backgroundColor: '#2563EB'
    },
    btnActive: {
        backgroundColor: '#D97706'
    },
    btnDelete: {
        backgroundColor: '#DC2626',
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderRadius: 4,
        alignItems: 'center'
    },
    btnActionText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold'
    },
});

const lightTheme = StyleSheet.create({
    container: {
        backgroundColor: '#F8FAFC'
    },
    text: {
        color: '#0F172A'
    },
    subText: {
        color: '#64748B',
        fontSize: 12
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    input: {
        borderColor: '#CBD5E1',
        color: '#0F172A',
        backgroundColor: '#F8FAFC'
    },
});

const darkTheme = StyleSheet.create({
    container: {
        backgroundColor: '#0F172A'
    },
    text: {
        color: '#F8FAFC'
    },
    subText: {
        color: '#94A3B8',
        fontSize: 12
    },
    card: {
        backgroundColor: '#1E293B',
        borderWidth: 1,
        borderColor: '#334155'
    },
    input: {
        borderColor: '#475569',
        color: '#F8FAFC',
        backgroundColor: '#0F172A'
    },
});