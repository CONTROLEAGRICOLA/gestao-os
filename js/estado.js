// =============================================================
// estado.js: o que o painel "sabe" neste momento
// =============================================================
export const estado = {
    lista: [],          // todas as OS que vieram da planilha
    selecionada: null,  // codigoTemp da OS aberta no detalhe

    aba: 'afazer',      // afazer | lancadas | rejeitadas | todas
    tipos: new Set(['LANCAMENTO', 'APONTAMENTO', 'ENCERRAMENTO']),   // tipos ligados
    periodo: 30,        // em dias (0 = tudo)
    busca: '',          // o que foi digitado na busca (sem acento, minúsculo)
    verOSde: new Set(), // ids dos analistas escolhidos (vazio = todos)
    euSou: '',           // id do analista que está usando este computador
    ordem: {            // ordem da fila em cada aba: 'antigo' (mais antigo primeiro) ou 'recente'
        afazer: 'antigo',
        lancadas: 'recente',
        rejeitadas: 'recente',
        todas: 'recente'
    },

    
};