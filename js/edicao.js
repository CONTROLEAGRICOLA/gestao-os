// =============================================================
// edicao.js: o analista corrige a solicitação antes de lançar
// =============================================================
import { estado } from './estado.js';
import { buscarListas, editarOS } from './api.js';
import { quemSouEu } from './usuario.js';
import { mostrarAviso, tituloDaOS, lerTalhoes, formatarHa } from './util.js';
import { montarOrdens, andamentoPorTalhao } from './ordens.js';
import { preencherTalhoes, textoDosTalhoes, conferirTalhoes } from './edicao-talhoes.js';
import { preencherEquipamentos, textoDosEquipamentos, conferirEquipamentos } from './edicao-equipamentos.js';
import { preencherInsumos, lerInsumos, resumoDosInsumos, conferirInsumos } from './edicao-insumos.js';

const dialogo = document.getElementById('dialogo-editar');
const form = document.getElementById('form-editar');
const carregando = document.getElementById('editar-carregando');
const erro = document.getElementById('editar-erro');
const botaoSalvar = document.getElementById('editar-salvar');
const selectCC = document.getElementById('editar-cc');
const selectOperacao = document.getElementById('editar-operacao');

let listas = null;          // fazendas e operações (rota 'init'), carregadas uma vez só
let osEditando = null;      // a OS que está no formulário
let valoresIniciais = {};   // como o formulário estava ao abrir
let modoLancada = false;    // true = editando OS já lançada (aba Ordens de Serviço)

const ordenar = (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true });

// ---------- Abrir ----------
// Em análise (botão Editar de Solicitações) ou OS lançada (botão Editar OS de Ordens de Serviço)
export async function abrirEdicao(codigoTemp) {
    const os = estado.lista.find(o => o.codigoTemp === codigoTemp);
    if (!os) return;
    const lancada = os.status_aprovacao === 'OS Lançada' && os.tipo_registro === 'LANCAMENTO';
    if (!lancada && os.status_aprovacao !== 'Em análise') return;
    if (!quemSouEu()) {
        mostrarAviso('Escolha quem é você em "Usuário" antes de editar.', 'alerta');
        return;
    }

    osEditando = os;
    modoLancada = lancada;
    erro.textContent = '';
    document.getElementById('editar-titulo').textContent =
        lancada ? `Editar OS ${numerosDoTexto(os.codigoOS).join(' · ')}` : 'Editar solicitação';
    document.getElementById('editar-subtitulo').textContent = lancada
        ? `${os.solicitante_nome}. Edite os campos da Ordem de Serviço`
        : `${tituloDaOS(os)} · ${os.solicitante_nome}. O responsável será notificado da alteração.`;
    form.hidden = true;
    carregando.hidden = false;
    carregando.textContent = 'Carregando listas…';
    dialogo.showModal();

    try {
        if (!listas) listas = await buscarListas();
    } catch (falha) {
        carregando.textContent = 'Não deu para carregar as listas. Feche e tente de novo.';
        return;
    }

    preencher(os);
    prepararModo(lancada);
    carregando.hidden = true;
    form.hidden = false;
    valoresIniciais = lerFormulario();
}

// ---------- Preencher o formulário com a OS ----------
function preencher(os) {
    const campos = form.elements;

    // Fazenda: sugestões no formato "código - nome", igual ao app
    document.getElementById('lista-fazendas').replaceChildren(
        ...listas.fazendas.map(f => new Option(f.descricao))
    );
    campos.fazenda.value = [os.fa_codigo, os.descricao_fazenda].filter(Boolean).join(' - ');

    // Centro de custo e, depois, as operações daquele centro de custo
    const centros = [...new Set(listas.operacoes.map(o => o.centroCusto))].filter(Boolean).sort(ordenar);
    preencherSelect(selectCC, centros, os.centro_custo);
    preencherOperacoes(os.operacao);

    campos.data_prevista_inicio.value = dataDoInput(os.data_prevista_inicio);
    campos.data_prevista_fim.value = dataDoInput(os.data_prevista_fim);
    campos.area_total.value = os.area_total || '';
    campos.pea.value = textoDe(os.pea);
    campos.programacao.value = os.programacao === 'NÃO' ? 'NÃO' : 'SIM';
    campos.carreador.value = textoDe(os.carreador);
    campos.observacao.value = textoDe(os.observacao);
    campos.codigo_os.value = numerosDoTexto(os.codigoOS).join(', ');
    campos.motivo.value = '';
    mostrarJustificativa();

    preencherTalhoes(os.talhoes, listas.fazendas);   // depois da fazenda: os talhões dependem dela
    preencherEquipamentos(os.equipamentos, listas.equipamentos);
    preencherInsumos(os, listas.insumos);
}
// OS lançada: trava fazenda, centro de custo e operação; mostra o número e o motivo.
// Em análise: o contrário. (Campo "disabled" não entra no FormData, então nem é comparado.)
function prepararModo(lancada) {
    form.elements.fazenda.readOnly = lancada;
    selectCC.disabled = lancada;
    selectOperacao.disabled = lancada;
    for (const id of ['campo-numero-os', 'campo-motivo']) {
        const campo = document.getElementById(id);
        campo.hidden = !lancada;
        campo.querySelector('input').disabled = !lancada;
    }
    avisarApontado();
}

// "10577, 10578" ou "10577;10578" → ['10577', '10578'] (sem repetir)
function numerosDoTexto(texto) {
    return [...new Set(String(texto ?? '').split(/[^\d]+/).filter(Boolean))];
}

// OS lançada: avisa (sem impedir) quando tira um talhão já apontado ou deixa a área menor que o apontado
function avisarApontado() {
    const aviso = document.getElementById('editar-apontado');
    aviso.textContent = '';
    if (!modoLancada) return;

    const ordem = montarOrdens(estado.lista).find(o => o.abertura.codigoTemp === osEditando.codigoTemp);
    if (!ordem) return;
    const agora = new Map(lerTalhoes(textoDosTalhoes()).map(t => [t.numero, t.area]));
    const avisos = [];
    for (const t of andamentoPorTalhao(ordem)) {
        if (t.feito <= 0) continue;   // talhão sem apontamento: pode mexer à vontade
        if (!agora.has(t.numero)) {
            avisos.push(`O talhão ${t.numero} saiu da OS, mas já tem ${formatarHa(t.feito)} apontados.`);
        } else if (agora.get(t.numero) < t.feito - 0.005) {
            avisos.push(`Talhão ${t.numero}: ${formatarHa(agora.get(t.numero))} é menos que os ${formatarHa(t.feito)} já apontados.`);
        }
    }
    aviso.textContent = avisos.join('\n');
}

// Monta as opções de um <select>. Se o valor atual não está na lista (dado antigo), entra também.
function preencherSelect(select, opcoes, atual) {
    const valor = String(atual ?? '').trim();
    const lista = valor && !opcoes.includes(valor) ? [valor, ...opcoes] : opcoes;
    select.replaceChildren(new Option('Selecione…', ''), ...lista.map(texto => new Option(texto)));
    select.value = valor;
}

function preencherOperacoes(atual) {
    const operacoes = listas.operacoes
        .filter(o => o.centroCusto === selectCC.value)
        .map(o => o.operacao);
    preencherSelect(selectOperacao, [...new Set(operacoes)].filter(Boolean).sort(ordenar), atual);
}

// O <input type="date"> só aceita aaaa-mm-dd
function dataDoInput(valor) {
    const achou = String(valor ?? '').match(/^\d{4}-\d{2}-\d{2}/);
    return achou ? achou[0] : '';
}

function textoDe(valor) {
    const texto = String(valor ?? '').trim();
    return texto === '-' ? '' : texto;
}

// A justificativa só aparece quando a programação é NÃO
function mostrarJustificativa() {
    document.getElementById('campo-carreador').hidden = form.elements.programacao.value !== 'NÃO';
}

// ---------- Ler, conferir e montar o pedido ----------

// { fazenda: '...', centro_custo: '...', ... }: as chaves são os "name" dos campos
function lerFormulario() {
    const valores = Object.fromEntries(new FormData(form));
    for (const chave in valores) valores[chave] = valores[chave].trim();
    if (valores.programacao !== 'NÃO') valores.carreador = '';   // justificativa só existe com NÃO
    valores.talhoes = textoDosTalhoes();
    valores.equipamentos = textoDosEquipamentos();
    valores.insumos = resumoDosInsumos();
    if ('codigo_os' in valores) valores.codigo_os = numerosDoTexto(valores.codigo_os).join(';');
    return valores;
}

function fazendaDaLista(texto) {
    return listas.fazendas.find(f => f.descricao === texto);
}

// Devolve o texto do problema, ou '' se está tudo certo
function conferir(atuais, mudou) {
    if (mudou('fazenda') && !fazendaDaLista(atuais.fazenda)) {
        return 'Escolha a fazenda na lista de sugestões.';
    }
    if (mudou('fazenda') || mudou('talhoes')) {
        const problema = conferirTalhoes();
        if (problema) return problema;
    }
    if ((mudou('centro_custo') || mudou('operacao')) && (!atuais.centro_custo || !atuais.operacao)) {
        return 'Escolha o centro de custo e a operação.';
    }
    if (mudou('data_prevista_inicio') || mudou('data_prevista_fim')) {
        if (!atuais.data_prevista_inicio) return 'Preencha a data início.';
        if (atuais.data_prevista_fim && atuais.data_prevista_fim < atuais.data_prevista_inicio) {
            return 'A data fim não pode ser antes da data início.';
        }
    }
    if (mudou('area_total') && !(Number(atuais.area_total) > 0)) {
        return 'A área total precisa ser maior que zero.';
    }
    if ((mudou('programacao') || mudou('carreador')) && atuais.programacao === 'NÃO' && !atuais.carreador) {
        return 'Sem programação, a justificativa é obrigatória.';
    }

    if (mudou('codigo_os')) {
        const problema = conferirNumero(atuais.codigo_os);
        if (problema) return problema;
    }

    if (mudou('equipamentos')) {
        const problema = conferirEquipamentos();
        if (problema) return problema;
    }
    if (mudou('insumos')) {
        const problema = conferirInsumos();
        if (problema) return problema;
    }
    return '';
}

// Número da OS (só na lançada): pelo menos um, e nenhum que já seja de outra OS
function conferirNumero(texto) {
    const numeros = texto ? texto.split(';') : [];
    if (numeros.length === 0) return 'Escreva o número da OS.';
    for (const outra of estado.lista) {
        if (outra.tipo_registro !== 'LANCAMENTO' || outra.codigoTemp === osEditando.codigoTemp) continue;
        const repetido = numerosDoTexto(outra.codigoOS).find(n => numeros.includes(n));
        if (repetido) return `O número ${repetido} já é de outra OS (${outra.descricao_fazenda}). Confira no PIMS.`;
    }
    return '';
}

// Só vai para o servidor o que mudou. A fazenda vira as 3 colunas da planilha.
function montarDados(atuais, mudou) {
    const dados = {};
    for (const chave in atuais) {
        if (chave === 'motivo') continue;   // o motivo vai separado (não é um campo da OS)
        if (mudou(chave)) dados[chave] = atuais[chave];
    }
    if ('fazenda' in dados) {
        const fazenda = fazendaDaLista(dados.fazenda);
        delete dados.fazenda;
        dados.fa_codigo = fazenda.codigo;
        dados.descricao_fazenda = fazenda.nome;
        dados.tipo_fazenda = Number(fazenda.codigo) < 300000 ? 'PRÓPRIA' : 'FORNECEDORES';   // mesma regra do app
    }
    return dados;
}

// ---------- Salvar ----------
form.addEventListener('submit', async evento => {
    evento.preventDefault();
    const atuais = lerFormulario();
    const mudou = chave => atuais[chave] !== valoresIniciais[chave];

    const problema = conferir(atuais, mudou);
    erro.textContent = problema;
    if (problema) return;

    const dados = montarDados(atuais, mudou);

    // Os insumos vão numa lista separada (na planilha, cada insumo é uma linha)
    let produtos;
    if ('insumos' in dados) {
        produtos = lerInsumos();
        delete dados.insumos;
    }

    if (Object.keys(dados).length === 0 && !produtos) {
        erro.textContent = 'Nada foi alterado.';
        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando…';
    try {
        const resposta = await editarOS(osEditando.codigoTemp, quemSouEu().nome, dados, produtos, atuais.motivo || '');

        Object.assign(osEditando, dados);   // atualiza a OS na memória, sem esperar a lista nova
        if ('area_total' in dados) osEditando.area_total = Number(dados.area_total);
        if ('codigo_os' in dados) osEditando.codigoOS = dados.codigo_os;
        if (produtos) osEditando.produtos = produtos;

        dialogo.close();
        mostrarAviso(resposta.alterados
            ? `Ajustado: ${resposta.campos.join(', ')}. O responsável recebe o aviso no celular.`
            : 'Nada mudou na planilha.');
        document.dispatchEvent(new CustomEvent('os-mudou', { detail: osEditando }));
    } catch (falha) {
        erro.textContent = 'Não salvou: ' + falha.message;
    } finally {
        botaoSalvar.disabled = false;
        botaoSalvar.textContent = 'Salvar alterações';
    }
});

// ---------- Botões ----------
// O detalhe é redesenhado toda hora, por isso o clique é ouvido na coluna inteira
document.getElementById('detalhe').addEventListener('click', evento => {
    if (evento.target.closest('#btn-editar')) abrirEdicao(estado.selecionada);
});

document.getElementById('editar-cancelar').addEventListener('click', () => dialogo.close());
selectCC.addEventListener('change', () => preencherOperacoes(''));
form.elements.programacao.addEventListener('change', mostrarJustificativa);


// Número da OS: só números, vírgula, ponto e vírgula e espaço
form.elements.codigo_os.addEventListener('input', evento => {
    evento.target.value = evento.target.value.replace(/[^\d,;\s]/g, '');
});

// Mexeu nos talhões (área, tirar, adicionar): confere de novo com o que já foi apontado
form.addEventListener('input', avisarApontado);
form.addEventListener('click', avisarApontado);