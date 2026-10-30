// =============================================================
// util.js: ferramentas pequenas usadas por vários arquivos
// =============================================================

// Cria um elemento HTML já com classe e texto
export function criar(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

// "23/10/2026 12:28" → momento em milissegundos (0 se não der para ler)
export function lerDataBR(texto) {
    const m = String(texto || '').match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?/);
    if (!m) return 0;
    return new Date(m[3], m[2] - 1, m[1], m[4] || 0, m[5] || 0).getTime();
}

// Quanto tempo a solicitação está esperando, e a cor do alerta
const HORAS_ATENCAO = 2;   // a partir daqui fica amarelo
const HORAS_ATRASO = 24;   // a partir daqui fica vermelho

export function tempoDeEspera(textoData) {
    const inicio = lerDataBR(textoData);
    if (!inicio) return { texto: '—', nivel: '' };

    const minutos = Math.max(0, Math.floor((Date.now() - inicio) / 60000));
    const horas = minutos / 60;

    let texto;
    if (minutos < 60) texto = `há ${minutos} min`;
    else if (horas < 48) texto = `há ${Math.floor(horas)} h`;
    else texto = `há ${Math.floor(horas / 24)} dias`;

    let nivel = 'ok';
    if (horas >= HORAS_ATRASO) nivel = 'atrasado';
    else if (horas >= HORAS_ATENCAO) nivel = 'atencao';

    return { texto, nivel };
}

// 24.5 → "24,50 ha"
export function formatarHa(valor) {
    const numero = Number(valor) || 0;
    return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ha';
}

// Como cada tipo aparece na tela
  // Como cada tipo aparece na tela
  export const NOMES_DOS_TIPOS = {
      LANCAMENTO: 'Abertura',
      APONTAMENTO: 'Apontamento',
      ENCERRAMENTO: 'Encerramento'
  };

// O "nome" da OS: usado na fila e no detalhe
export function tituloDaOS(os) {
    if (os.tipo_registro === 'LANCAMENTO') {
        return os.codigoOS ? `OS ${os.codigoOS}` : `Solicitação ${os.codigoTemp}`;
    }
    const numero = os.numero_origem || os.codigoOS;
    const nome = numero ? `OS ${numero}` : `OS sem nº (${os.os_origem})`;
    if (os.tipo_registro === 'ENCERRAMENTO') return `${nome} · encerrar`;
    return `${nome} · ${formatarHa(os.area_total)}`;
}

// "2026-10-20" → "20/10/2026" (se vier em outro formato, devolve como veio)
export function dataCurta(texto) {
    const s = String(texto || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

// Início e fim → "20/10/2026 até 25/10/2026" (ou só uma data, se forem iguais)
export function formatarPeriodo(inicio, fim) {
    const a = dataCurta(inicio);
    const b = dataCurta(fim);
    if (a && b && a !== b) return `${a} até ${b}`;
    return a;
}

// "1.6" → "1,6" (se não for número, devolve como veio)
export function numeroBR(valor) {
    const texto = String(valor ?? '').trim();
    const numero = Number(texto);
    if (texto === '' || isNaN(numero)) return texto;
    return numero.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

// "22:10.00ha, 23:10.00ha" → [{ numero: '22', area: 10 }, { numero: '23', area: 10 }]
export function lerTalhoes(texto) {
    return String(texto ?? '')
        .split(',')
        .map(pedaco => pedaco.trim())
        .filter(pedaco => pedaco && pedaco !== '-')
        .map(pedaco => {
            const [numero, area = ''] = pedaco.split(':');
            return { numero: numero.trim(), area: parseFloat(area) || 0 };
        });
}

// "32131 JD 6180J [10240224 TRATOR PESADO], 35018 JD M4025" → [{ nome, cc }, ...]
export function lerEquipamentos(texto) {
    return String(texto ?? '')
        .split(',')
        .map(pedaco => pedaco.trim())
        .filter(pedaco => pedaco && pedaco !== '-')
        .map(pedaco => {
            const [nome, resto = ''] = pedaco.split('[');
            return { nome: nome.trim(), cc: resto.replace(']', '').trim() };
        });
}

// "São Francisco" → "sao francisco" (a busca não depende de acento nem de maiúscula)
export function semAcento(texto) {
    return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// Mensagem rápida no canto da tela, que some sozinha
let timerDoAviso;

export function mostrarAviso(texto, tipo = 'ok') {
    const aviso = document.getElementById('aviso');
    aviso.textContent = texto;
    aviso.dataset.tipo = tipo;
    aviso.hidden = false;

    clearTimeout(timerDoAviso);
    timerDoAviso = setTimeout(() => { aviso.hidden = true; }, 6000);
}

// Troca o conteúdo de uma área que rola, decidindo onde a rolagem fica:
// mesma "chave" do desenho anterior (foi só uma atualização) → fica onde estava
// chave nova (outra OS, outra aba, outro filtro) → volta para o topo
export function redesenhar(caixa, chave, filhos) {
    const mesma = caixa.dataset.chave === chave;
    const rolagem = caixa.scrollTop;
    caixa.replaceChildren(...filhos);
    caixa.dataset.chave = chave;
    caixa.scrollTop = mesma ? rolagem : 0;
}