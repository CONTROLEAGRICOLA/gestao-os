// =============================================================
// decisao.js: a coluna da direita (Lançar | Rejeitar)
// =============================================================
import { estado } from './estado.js';
import { lancarOS, rejeitarOS, cancelarOS, anexarPDF, voltarParaAnalise } from './api.js';
import { atualizarAgora } from './atualizacao.js';
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
    // Cartão da situação: só redesenha se algo mudou (senão apagaria o PDF escolhido ou o motivo sendo digitado)
    const situacao = document.getElementById('situacao');
    if (!situacao.hidden && situacao.dataset.desenhado === marcaDaSituacao(os)) return;
    desenharDecisao(os);
}

// Limpa o cartão e prepara o número da OS
function prepararDecisao(os) {
    trocarModo('lancar');
    document.getElementById('form-lancar').reset();
    document.getElementById('form-rejeitar').reset();
    document.getElementById('form-cancelar').reset();
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

    // Rejeitada: o analista ainda pode cancelar (se o líder não for corrigir)
    const formCancelar = document.getElementById('form-cancelar-rejeitada');
    formCancelar.hidden = os.status_aprovacao !== 'Rejeitado';
    formCancelar.reset();
    document.getElementById('situacao-aviso').textContent = '';

    // Rejeitada: o analista pode devolver para análise (a pendência se resolveu)
    document.getElementById('bloco-voltar-analise').hidden = os.status_aprovacao !== 'Rejeitado';
    document.getElementById('voltar-analise-aviso').textContent = '';

    // Lançada: PDF, número e edição ficam na aba Ordens de Serviço
    const verNaOS = document.getElementById('ver-na-os');
    verNaOS.hidden = os.status_aprovacao !== 'OS Lançada';
    verNaOS.dataset.ordem = os.tipo_registro === 'LANCAMENTO' ? os.codigoTemp : os.os_origem;   // apontamento: a OS de origem
    document.getElementById('situacao').dataset.desenhado = marcaDaSituacao(os);

    if (os.status_aprovacao === 'Rejeitado') {
        titulo.textContent = 'Rejeitada';
        texto.textContent = 'Motivo: ' + (os.justificativa_controle || 'não informado');
    } else if (os.status_aprovacao === 'Cancelado pelo controle') {
        titulo.textContent = 'Cancelada pelo controle';
        texto.textContent = 'Motivo: ' + (os.justificativa_controle || 'não informado');
    } else if (os.status_aprovacao === 'Cancelado pelo líder') {
        titulo.textContent = 'Cancelada pelo líder';
        texto.textContent = 'O líder desistiu de corrigir. Motivo da rejeição: ' + (os.justificativa_controle || 'não informado');

    } else {
        titulo.textContent = 'Lançada';
        texto.textContent = (os.codigoOS ? `Registrada como OS ${numerosDaOS(os).join(' · ')}. ` : '')
    }
}

// "11038;11039" → ['11038', '11039'] (uma solicitação pode virar mais de uma OS)
// O que o cartão da situação está mostrando (se nada disso mudou, não precisa redesenhar)
function marcaDaSituacao(os) {
    return [os.codigoTemp, os.status_aprovacao, os.codigoOS, os.pdf_url].join('|');
}
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
    document.getElementById('form-cancelar').hidden = modo !== 'cancelar';
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
export function problemaNoPDF(arquivo) {
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
        atualizarAgora();   // a tela pode estar velha (outro analista decidiu antes)
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
        atualizarAgora();   // a tela pode estar velha (outro analista decidiu antes)
    } finally {
        botao.disabled = false;
        botao.textContent = 'Rejeitar e avisar o líder';
    }
}

// ---------- Cancelar (não tem conserto: o líder é avisado e não reenvia) ----------
// Serve para os dois formulários: o da OS em análise e o da rejeitada
async function cancelar(campo, botao, aviso) {
    const os = osAberta();
    if (!os) return;

    const eu = quemSouEu();
    if (!eu) {
        aviso.textContent = 'Escolha quem você é em "Eu sou" (no topo) antes de cancelar.';
        return;
    }

    const motivo = campo.value.trim();
    if (!motivo) {
        aviso.textContent = 'Escreva o motivo do cancelamento para o líder.';
        return;
    }
    if (!confirm('Cancelar esta solicitação?\n\nO líder é avisado e não vai conseguir corrigir nem reenviar.')) return;

    const textoDoBotao = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Cancelando…';
    aviso.textContent = '';

    try {
        await cancelarOS(os.codigoTemp, motivo, eu.nome);
        os.status_aprovacao = 'Cancelado pelo controle';
        os.justificativa_controle = motivo;
        mostrarAviso('Solicitação cancelada. O líder foi avisado.');
        avisarQueMudou(os);
    } catch (erro) {
        aviso.textContent = 'Não foi possível cancelar: ' + erro.message;
    } finally {
        botao.disabled = false;
        botao.textContent = textoDoBotao;
        atualizarAgora();   // deu certo ou não, confere a lista (apontamentos pendurados também mudam)
    }
}

// ---------- Voltar para análise (a pendência da rejeitada se resolveu) ----------
async function voltarAnalise() {
    const os = osAberta();
    if (!os) return;
    const aviso = document.getElementById('voltar-analise-aviso');

    const eu = quemSouEu();
    if (!eu) {
        aviso.textContent = 'Escolha quem você é em "Usuário" (no topo) antes.';
        return;
    }
    if (!confirm('Voltar esta solicitação para análise?\n\nO líder é avisado e não precisa corrigir nem reenviar.')) return;

    const botao = document.getElementById('voltar-analise-botao');
    botao.disabled = true;
    botao.textContent = 'Voltando…';
    aviso.textContent = '';

    try {
        await voltarParaAnalise(os.codigoTemp, eu.nome);
        os.status_aprovacao = 'Em análise';
        os.justificativa_controle = '';
        mostrarAviso('Voltou para análise. O líder foi avisado.');
        avisarQueMudou(os);
    } catch (erro) {
        aviso.textContent = 'Não foi possível: ' + erro.message;
        atualizarAgora();   // a tela pode estar velha (o líder pode ter reenviado ou cancelado)
    } finally {
        botao.disabled = false;
        botao.textContent = '↩️ Voltar para análise';
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

document.getElementById('ver-na-os').addEventListener('click', evento => {
    document.dispatchEvent(new CustomEvent('abrir-ordem', { detail: evento.currentTarget.dataset.ordem }));
});

document.getElementById('form-lancar').addEventListener('submit', evento => {
    evento.preventDefault();
    lancar();
});

document.getElementById('form-rejeitar').addEventListener('submit', evento => {
    evento.preventDefault();
    rejeitar();
});

document.getElementById('form-cancelar').addEventListener('submit', evento => {
    evento.preventDefault();
    cancelar(document.getElementById('cancelar-motivo'), document.getElementById('cancelar-botao'),
        document.getElementById('decisao-aviso'));
});

document.getElementById('voltar-analise-botao').addEventListener('click', voltarAnalise);

document.getElementById('form-cancelar-rejeitada').addEventListener('submit', evento => {
    evento.preventDefault();
    cancelar(document.getElementById('cancelar-rejeitada-motivo'), document.getElementById('cancelar-rejeitada-botao'),
        document.getElementById('situacao-aviso'));
});