// =============================================================
// api.js: toda conversa com o Apps Script passa por aqui
// =============================================================
// link do appscript 
const URL_API = 'https://script.google.com/macros/s/AKfycbyQZWlJ8xGg-VqRLvWWPuowCQ2QUJg-CEXjW8oM_tEo7fqVsGOov2UZxU85snQtvyLp/exec';

// Pede dados ao Apps Script (GET) e devolve a resposta já em objeto
async function pedir(action, parametros = {}, segundos = 20) {
    const query = new URLSearchParams({ action, ...parametros });
    const resposta = await fetch(`${URL_API}?${query}`, {
        signal: AbortSignal.timeout(segundos * 1000)
    });
    const json = await resposta.json();
    if (!json.success) {
        throw new Error(json.error || 'O servidor não conseguiu responder.');
    }
    return json;
}

// Só a versão do banco (resposta pequena, para saber se algo mudou)
export async function buscarVersao() {
    const json = await pedir('versao');
    return json.versao;
}

// Todas as OS da planilha
export async function buscarTodasOS() {
    const json = await pedir('buscar_todas_os', {}, 60);
    const lista = json.dados;

    // Apontamento e encerramento guardam no os_origem o codigoTemp da OS mãe.
    // Aqui descobrimos o NÚMERO da OS mãe, para mostrar na tela.
    const numeroPorCodigo = new Map(lista.map(os => [os.codigoTemp, os.codigoOS]));
    for (const os of lista) {
        os.numero_origem = numeroPorCodigo.get(os.os_origem) || '';
    }

    return { versao: json.versao, lista };
}

// A base de analistas (aba ANALISTAS)
export async function buscarAnalistas() {
    const json = await pedir('buscar_analistas');
    return json.dados;
}

// O histórico de uma OS (aba LOG)
export async function buscarHistorico(codigoTemp) {
    const json = await pedir('buscar_historico', { codigoTemp });
    return json.dados;
}

// As listas do app (fazendas, operações, insumos, equipamentos), para o formulário de edição
export async function buscarListas() {
    const json = await pedir('init', {}, 60);
    return json.dados;
}

// ---------- Envios (gravam na planilha) ----------

// Manda uma ação para o Apps Script (POST) e devolve a resposta já em objeto
async function enviar(dados, segundos = 60) {
    const resposta = await fetch(URL_API, {
        method: 'POST',
        body: JSON.stringify(dados),
        signal: AbortSignal.timeout(segundos * 1000)
    });
    const json = await resposta.json();
    if (!json.success) {
        throw new Error(json.error || 'O servidor recusou o pedido.');
    }
    return json;
}

export function lancarOS(codigoTemp, numero, analista) {
    return enviar({ action: 'lançar_oficial', codigoTemp, codigoOS: numero, analista });
}

export function rejeitarOS(codigoTemp, justificativa, analista) {
    return enviar({ action: 'rejeitar_os', codigoTemp, justificativa, analista });
}

// Cancelar pelo controle: o líder é avisado e não consegue reenviar
export function cancelarOS(codigoTemp, motivo, analista) {
    return enviar({ action: 'cancelar_controle', codigoTemp, motivo, analista });
}

// Só vai o que mudou. Se "produtos" não for passado, os insumos ficam como estão.
export function editarOS(codigoTemp, analista, dados, produtos) {
    return enviar({ action: 'editar_analista', codigoTemp, analista, dados, produtos });
}

export async function anexarPDF(codigoTemp, arquivo, analista = '') {
    const base64 = await lerBase64(arquivo);
    return enviar({ action: 'anexar_pdf', codigoTemp, base64, analista }, 120);
}

// Lê um arquivo do computador e devolve o conteúdo como texto base64
function lerBase64(arquivo) {
    return new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(String(leitor.result).split(',')[1]);
        leitor.onerror = () => reject(leitor.error);
        leitor.readAsDataURL(arquivo);
    });
}

// Cadastra este navegador para receber os avisos do painel (push)
export function registrarPainel(token) {
    return enviar({
        action: 'salvar_token',
        cracha: 'PAINEL',
        token,
        aparelho: 'Painel · ' + navigator.userAgent.slice(0, 120)
    });
}

// ---------- Relatórios dos líderes ----------

// Quem está na aba de login (crachá e nome), para escolher a quem mandar
export async function buscarLideres() {
    const json = await pedir('buscar_lideres');
    return json.dados;
}

// Manda um PDF para o líder (o servidor guarda no Drive e avisa no celular dele)
export async function enviarRelatorio(cracha, arquivo, analista) {
    const base64 = await lerBase64(arquivo);
    return enviar({ action: 'enviar_relatorio', cracha, arquivo: arquivo.name, base64, analista }, 120);
}
