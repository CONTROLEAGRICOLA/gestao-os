// =============================================================
// decisao.js: a coluna da direita (Lançar | Rejeitar)
// =============================================================
import { estado } from './estado.js';
import { lancarOS, rejeitarOS, anexarPDF } from './api.js';
import { mostrarAviso } from './util.js';
import { quemSouEu } from './usuario.js';

// Mostra o cartão certo para a OS aberta
export function desenharDecisao(os) {
    const emAnalise = os.status_aprovacao === 'Em análise';
    document.getElementById('decisao').hidden = !emAnalise;
    document.getElementById('situacao').hidden = emAnalise;

    if (emAnalise) prepararDecisao(os);
    else desenharSituacao(os);
}

// Quando a lista chega de novo: só mexe no cartão se a situação da OS mudou
export function atualizarDecisao(os) {
    const mostrandoDecisao = !document.getElementById('decisao').hidden;
    if (mostrandoDecisao && os.status_aprovacao === 'Em análise') return;   // não apaga o que está sendo digitado
    desenharDecisao(os);
}

// Limpa o cartão e prepara o número da OS
function prepararDecisao(os) {
    trocarModo('lancar');
    document.getElementById('form-lancar').reset();
    document.getElementById('form-rejeitar').reset();
    document.getElementById('lancar-pdf-nome').textContent = 'Anexar PDF da O.S';
    document.getElementById('lancar-pdf-info').textContent = 'opcional · clique ou arraste aqui';
    document.getElementById('decisao-aviso').textContent = '';

    const numero = document.getElementById('lancar-numero');
    const dica = document.getElementById('lancar-dica');

    if (os.tipo_registro === 'LANCAMENTO') {
        numero.readOnly = false;
        dica.textContent = `Último número lançado: ${maiorNumeroDeOS()}. Confira no PIMS.`;
    } else {
        // Apontamento e encerramento ficam registrados na OS de origem
        numero.value = os.numero_origem;
        numero.readOnly = true;
        dica.textContent = os.numero_origem
            ? 'Fica registrado na OS de origem.'
            : 'A OS de origem ainda não foi lançada. Lance a abertura primeiro.';
    }
    atualizarBotaoLancar();
    conferir();
}

function desenharSituacao(os) {
    const titulo = document.getElementById('situacao-titulo');
    const texto = document.getElementById('situacao-texto');

    if (os.status_aprovacao === 'Rejeitado') {
        titulo.textContent = 'Rejeitada';
        texto.textContent = 'Motivo: ' + (os.justificativa_controle || 'não informado');
    } else {
        titulo.textContent = 'Lançada';
        texto.textContent = (os.codigoOS ? `Registrada como OS ${os.codigoOS}. ` : '')
            + (os.pdf_url ? 'PDF anexado.' : 'Sem PDF anexado.');
    }
}

// "11038;11039" → ['11038', '11039'] (uma solicitação pode virar mais de uma OS)
function numerosDaOS(os) {
    return String(os.codigoOS ?? '').split(';').map(n => n.trim()).filter(Boolean);
}

function maiorNumeroDeOS() {
    let maior = 0;
    for (const os of estado.lista) {
        for (const parte of numerosDaOS(os)) {
            const numero = parseInt(parte, 10);
            if (numero > maior) maior = numero;
        }
    }
    return maior;
}

function trocarModo(modo) {
    for (const aba of document.querySelectorAll('.decisao-aba')) {
        aba.classList.toggle('ativa', aba.dataset.modo === modo);
    }
    document.getElementById('form-lancar').hidden = modo !== 'lancar';
    document.getElementById('form-rejeitar').hidden = modo !== 'rejeitar';
}

function atualizarBotaoLancar() {
    const numero = document.getElementById('lancar-numero').value.trim();
    const botao = document.getElementById('lancar-botao');
    // Apontamento e encerramento não abrem OS nova: o botão diz o que vai ser lançado
    const textos = { APONTAMENTO: 'Lançar apontamento', ENCERRAMENTO: 'Lançar encerramento' };
    botao.textContent = textos[osAberta()?.tipo_registro] || (numero ? `Lançar OS ${numero}` : 'Lançar OS');
    botao.disabled = !numero;
}

function aoEscolherPDF() {
    const arquivo = document.getElementById('lancar-pdf').files[0];
    if (!arquivo) return;

    document.getElementById('lancar-pdf-nome').textContent = arquivo.name;
    document.getElementById('lancar-pdf-info').textContent =
        `${Math.round(arquivo.size / 1024)} KB · pronto para anexar`;

    // "O.S 11071 - 1 APLIC ... .pdf" (ou "11071 - ....pdf") → preenche 11071
    const numero = document.getElementById('lancar-numero');
    const achado = arquivo.name.match(/^(?:O\.?\s?S\.?\s*)?(\d{4,6})/i);
    if (achado && !numero.value && !numero.readOnly) {
        numero.value = achado[1];
        document.getElementById('lancar-dica').textContent = 'Lido do nome do arquivo. Confira antes de lançar.';
    }
    atualizarBotaoLancar();
    conferir();
}

// A OS que está aberta no detalhe
function osAberta() {
    return estado.lista.find(o => o.codigoTemp === estado.selecionada);
}

// Confere o número e o PDF antes de lançar (avisa, mas não impede)
function conferir() {
    const os = osAberta();
    const numero = document.getElementById('lancar-numero').value;
    const arquivo = document.getElementById('lancar-pdf').files[0];
    const alertas = [];

    if (os.tipo_registro === 'LANCAMENTO' && numero) {
        const usados = new Set();
        for (const outra of estado.lista) {
            for (const n of numerosDaOS(outra)) usados.add(n);
        }
        const repetidos = numero.split(';').filter(n => usados.has(n));
        if (repetidos.length > 0) {
            alertas.push(`Já existe OS lançada com o número ${repetidos.join(', ')}. Confira.`);
        }
    }

    const faDoPDF = arquivo?.name.match(/FA\s*(\d{5,6})/i);
    if (faDoPDF && os.fa_codigo && faDoPDF[1] !== String(os.fa_codigo)) {
        alertas.push(`O PDF é da FA ${faDoPDF[1]}, mas esta solicitação é da FA ${os.fa_codigo}.`);
    }

    document.getElementById('lancar-alerta').textContent = alertas.join('\n');
}

// O PDF tem algum problema que impede o envio? (devolve o texto do problema, ou vazio)
function problemaNoPDF(arquivo) {
    if (arquivo.type !== 'application/pdf') return 'O arquivo precisa ser PDF.';
    if (arquivo.size === 0) return 'O PDF está vazio (0 KB). Gere o arquivo de novo no PIMS.';
    if (arquivo.size > 10 * 1024 * 1024) return 'O PDF passa de 10 MB.';
    return '';
}


function mostrarErro(texto) {
    document.getElementById('decisao-aviso').textContent = texto;
}

// Avisa o resto do painel que esta OS mudou (o main.js escuta e redesenha)
function avisarQueMudou(os) {
    document.dispatchEvent(new CustomEvent('os-mudou', { detail: os }));
}

// ---------- Lançar ----------
async function lancar() {
    const os = osAberta();
    const numero = document.getElementById('lancar-numero').value.trim();
    const arquivo = document.getElementById('lancar-pdf').files[0];
    if (!os || !numero) return;

    const eu = quemSouEu();
    if (!eu) {
        mostrarErro('Escolha quem você é em "Eu sou" (no topo) antes de lançar.');
        return;
    }

    const problema = arquivo ? problemaNoPDF(arquivo) : '';
    if (problema) {
        mostrarErro(problema);
        return;
    }

    const botao = document.getElementById('lancar-botao');
    botao.disabled = true;
    botao.textContent = 'Lançando…';
    mostrarErro('');

    try {
        await lancarOS(os.codigoTemp, numero, eu.nome);
        os.status_aprovacao = 'OS Lançada';
        os.codigoOS = numero;

        let mensagem = os.tipo_registro === 'LANCAMENTO'
            ? `OS ${numero} lançada.`
            : `Registrado na OS ${numero}.`;
        let tipo = 'ok';

        if (arquivo) {
            try {
                const resposta = await anexarPDF(os.codigoTemp, arquivo, eu.nome);
                os.pdf_url = resposta.link;
            } catch (erro) {
                mensagem = `OS ${numero} lançada, mas o PDF não foi anexado (${erro.message}).`;
                tipo = 'alerta';
            }
        }

        mostrarAviso(mensagem, tipo);
        avisarQueMudou(os);
    } catch (erro) {
        mostrarErro('Não foi possível lançar: ' + erro.message);
    } finally {
        atualizarBotaoLancar();
    }
}

// ---------- Rejeitar ----------
async function rejeitar() {
    const os = osAberta();
    if (!os) return;

    const eu = quemSouEu();
    if (!eu) {
        mostrarErro('Escolha quem você é em "Eu sou" (no topo) antes de rejeitar.');
        return;
    }

    const justificativa = document.getElementById('rejeitar-detalhe').value.trim();
    if (!justificativa) {
        mostrarErro('Escreva o motivo da rejeição para o líder.');
        return;
    }

    const botao = document.getElementById('rejeitar-botao');
    botao.disabled = true;
    botao.textContent = 'Rejeitando…';
    mostrarErro('');

    try {
        await rejeitarOS(os.codigoTemp, justificativa, eu.nome);
        os.status_aprovacao = 'Rejeitado';
        os.justificativa_controle = justificativa;
        mostrarAviso('Solicitação rejeitada.');
        avisarQueMudou(os);
    } catch (erro) {
        mostrarErro('Não foi possível rejeitar: ' + erro.message);
    } finally {
        botao.disabled = false;
        botao.textContent = 'Rejeitar e avisar o líder';
    }
}

// ---------- Os botões do cartão ----------
document.querySelector('.decisao-abas').addEventListener('click', evento => {
    const aba = evento.target.closest('.decisao-aba');
    if (aba) trocarModo(aba.dataset.modo);
});

document.getElementById('lancar-numero').addEventListener('input', evento => {
    evento.target.value = evento.target.value.replace(/[^\d;]/g, '');   // só números e ;
    atualizarBotaoLancar();
    conferir();
});

document.getElementById('lancar-pdf').addEventListener('change', aoEscolherPDF);

document.getElementById('form-lancar').addEventListener('submit', evento => {
    evento.preventDefault();
    lancar();
});

document.getElementById('form-rejeitar').addEventListener('submit', evento => {
    evento.preventDefault();
    rejeitar();
});