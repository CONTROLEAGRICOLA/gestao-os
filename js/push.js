// =============================================================
// push.js: recebe avisos do servidor na hora (Firebase Cloud Messaging)
// =============================================================
import { registrarPainel } from './api.js';

// Os mesmos valores do app de lançamento (index.html do GitHub)
const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyD7D6yXV2YlCFX7iotnXUKlqUF9SCveOVc',
    authDomain: 'os-clealco.firebaseapp.com',
    projectId: 'os-clealco',
    storageBucket: 'os-clealco.firebasestorage.app',
    messagingSenderId: '175045739560',
    appId: '1:175045739560:web:14ac6b6e379e6ca9c7e11d'
};
const VAPID_KEY = 'BNgL56x4goAPaj2ccdRrr14bT_tEbfDDRvVkHk5qJo22Nt-cluGi4UohM_9LTncyCRDPeJYytVrEelv7M9Uisvc';
const CHAVE_TOKEN = 'gestao_os_token_push';

function pushSuportado() {
    return typeof firebase !== 'undefined'
        && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Ao abrir o painel: liga o service worker e, se já tem permissão, confere o cadastro
export async function iniciarPush() {
    if (!pushSuportado()) return;
    try {
        firebase.initializeApp(FIREBASE_CONFIG);
        await navigator.serviceWorker.register('./sw.js');

        // Painel na frente: o aviso chega aqui (o sw.js não mostra notificação)
        firebase.messaging().onMessage(mensagem => {
            document.dispatchEvent(new CustomEvent('push-chegou', { detail: mensagem.data || {} }));
        });

        // Clique na notificação do Windows: o sw.js manda o código da OS para cá
        navigator.serviceWorker.addEventListener('message', evento => {
            if (evento.data?.abrirOS) {
                document.dispatchEvent(new CustomEvent('abrir-os', { detail: evento.data.abrirOS }));
            }
        });

        if (Notification.permission === 'granted') await cadastrarNavegador();
    } catch (erro) {
        console.warn('Push do painel indisponível:', erro.message);
    }
}

// No clique do sino: pede permissão e cadastra este navegador
export async function ativarPush() {
    if (!pushSuportado()) return;
    try {
        if (Notification.permission === 'default') await Notification.requestPermission();
        if (Notification.permission === 'granted') await cadastrarNavegador();
    } catch (erro) {
        console.warn('Não deu para ativar o push:', erro.message);
    }
}

async function cadastrarNavegador() {
    const registro = await navigator.serviceWorker.ready;
    const token = await firebase.messaging().getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
    if (!token || token === localStorage.getItem(CHAVE_TOKEN)) return;   // já estava cadastrado
    await registrarPainel(token);
    localStorage.setItem(CHAVE_TOKEN, token);
    console.log('Push do painel ativado.');
}