// =============================================================
// ferramentas.js: o botão flutuante abre o menu de ferramentas do analista.
// Cada ferramenta é um <button class="ferramenta"> dentro do menu, no index.html.
// Quem abre a janela de cada uma é o arquivo dela (relatorios.js, programacao.js...).
// Abrir/fechar é só pôr/tirar a classe "aberto" na caixa: o CSS faz a animação.
// =============================================================
const caixa = document.getElementById('ferramentas');
const botao = document.getElementById('btn-ferramentas');
const menu = document.getElementById('ferramentas-menu');

menu.hidden = false;   // quem esconde agora é o CSS (assim dá para animar o fechar também)

function menuAberto() {
    return caixa.classList.contains('aberto');
}

// Abre (true) ou fecha (false) o menu
function mostrarMenu(abrir) {
    caixa.classList.toggle('aberto', abrir);
    botao.setAttribute('aria-expanded', String(abrir));
}

botao.addEventListener('click', () => mostrarMenu(!menuAberto()));

// Escolheu uma ferramenta: fecha o menu (a janela dela abre pelo arquivo dela)
menu.addEventListener('click', evento => {
    if (evento.target.closest('.ferramenta')) mostrarMenu(false);
});

// Clique fora do menu (inclusive no fundo escurecido) ou Esc: fecha
document.addEventListener('click', evento => {
    if (!menuAberto()) return;
    if (evento.target.closest('.ferramentas-menu, #btn-ferramentas')) return;
    mostrarMenu(false);
});
document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && menuAberto()) {
        mostrarMenu(false);
        botao.focus();
    }
});