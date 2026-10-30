// =============================================================
// sw.js do PAINEL: recebe o aviso do servidor mesmo com o painel minimizado ou fechado
// =============================================================
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// Clique na notificação: traz o painel para frente (ou abre) e pede para abrir a OS
self.addEventListener('notificationclick', evento => {
    evento.notification.close();
    const codigo = evento.notification.data?.codigoTemp || '';

    evento.waitUntil((async () => {
        const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const painel = janelas.find(janela => janela.url.startsWith(self.registration.scope));
        if (painel) {
            await painel.focus();
            painel.postMessage({ abrirOS: codigo });
        } else {
            await self.clients.openWindow('./index.html');
        }
    })());
});

firebase.initializeApp({
    apiKey: 'AIzaSyD7D6yXV2YlCFX7iotnXUKlqUF9SCveOVc',
    authDomain: 'os-clealco.firebaseapp.com',
    projectId: 'os-clealco',
    storageBucket: 'os-clealco.firebasestorage.app',
    messagingSenderId: '175045739560',
    appId: '1:175045739560:web:14ac6b6e379e6ca9c7e11d'
});

// Chegou aviso e o painel não está na frente: mostra a notificação do Windows
firebase.messaging().onBackgroundMessage(mensagem => {
    const dados = mensagem.data || {};
    return self.registration.showNotification(dados.titulo || 'Gestão de OS', {
        body: dados.texto || '',
        icon: './logo.png',
        tag: dados.codigoTemp,
        data: { codigoTemp: dados.codigoTemp }
    });
});