// =============================================================
// edicao.js: o analista corrige a solicitação antes de lançar
// =============================================================
import { estado } from './estado.js';
import { buscarListas, editarOS } from './api.js';
import { quemSouEu } from './usuario.js';
import { mostrarAviso, tituloDaOS } from './util.js';
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

const ordenar = (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true });

// ---------- Abrir ----------
async function abrirEdicao() {
    const os = estado.lista.find(o => o.codigoTemp === estado.selecionada);
    if (!os || os.status_aprovacao !== 'Em análise') return;
    if (!quemSouEu()) {
        mostrarAviso('Escolha quem é você em "Usuário" antes de editar.', 'alerta');
        return;
    }

    osEditando = os;
    erro.textContent = '';
    document.getElementById('editar-subtitulo').textContent =
        `${tituloDaOS(os)} · ${os.solicitante_nome}. O líder recebe um aviso com o que mudou.`;
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
    mostrarJustificativa();

    preencherTalhoes(os.talhoes, listas.fazendas);   // depois da fazenda: os talhões dependem dela
    preencherEquipamentos(os.equipamentos, listas.equipamentos);
    preencherInsumos(os, listas.insumos);
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

// Só vai para o servidor o que mudou. A fazenda vira as 3 colunas da planilha.
function montarDados(atuais, mudou) {
    const dados = {};
    for (const chave in atuais) {
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
        const resposta = await editarOS(osEditando.codigoTemp, quemSouEu().nome, dados, produtos);

        Object.assign(osEditando, dados);   // atualiza a OS na memória, sem esperar a lista nova
        if ('area_total' in dados) osEditando.area_total = Number(dados.area_total);
        if (produtos) osEditando.produtos = produtos;

        dialogo.close();
        mostrarAviso(resposta.alterados
            ? `Ajustado: ${resposta.campos.join(', ')}. O líder recebe o aviso no celular.`
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
    if (evento.target.closest('#btn-editar')) abrirEdicao();
});

document.getElementById('editar-cancelar').addEventListener('click', () => dialogo.close());
selectCC.addEventListener('change', () => preencherOperacoes(''));
form.elements.programacao.addEventListener('change', mostrarJustificativa);