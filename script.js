class GerenciadorAniversarios {
    constructor() {
        this.aniversariantes = JSON.parse(localStorage.getItem('aniversariantes')) || [];
        
        // Pré-carrega o som
        this.somAlerta = document.getElementById('somAlerta');
        this.somAlerta.load();
        // Configura o volume
        this.somAlerta.volume = 1.0; // Volume máximo
        
        this.inicializar();

        // Adicionar o listener para o botão de exportar
        document.getElementById('btnExportar').addEventListener('click', () => this.exportarParaCalendario());
    }

    inicializar() {
        this.form = document.getElementById('formAniversariante');
        this.lista = document.getElementById('listaAniversariantes');
        this.somAlerta = document.getElementById('somAlerta');

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.configurarFiltros();
        this.renderizarLista();

        // Verifica imediatamente ao carregar a página
        this.verificarAniversarianteDoDia();

        // Configura verificações periódicas
        // Verifica a cada minuto
        setInterval(() => {
            const agora = new Date();
            // Verifica se é meia-noite (novo dia)
            if (agora.getHours() === 0 && agora.getMinutes() === 0) {
                this.verificarAniversarianteDoDia();
            }
        }, 60000); // 60000 ms = 1 minuto

        // Verifica a cada vez que o usuário volta para a página
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.verificarAniversarianteDoDia();
            }
        });

        this.campoBusca = document.getElementById('busca');
        this.campoBusca.addEventListener('input', () => this.buscarAniversariantes());
    }

    handleSubmit(e) {
        e.preventDefault();
        const fotoInput = document.getElementById('foto');
        const file = fotoInput.files[0];
        
        const comprimirImagem = (imagemBase64) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.src = imagemBase64;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 400; // Largura máxima da imagem
                    const MAX_HEIGHT = 400; // Altura máxima da imagem
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7)); // Comprime para JPEG com 70% de qualidade
                };
            });
        };

        const processarSubmit = async (fotoBase64 = null) => {
            let fotoProcessada = fotoBase64;
            if (fotoBase64) {
                try {
                    fotoProcessada = await comprimirImagem(fotoBase64);
                } catch (error) {
                    console.error('Erro ao comprimir imagem:', error);
                }
            }

            const dados = {
                id: this.form.dataset.id || Date.now().toString(),
                nome: document.getElementById('nome').value,
                dataNascimento: document.getElementById('dataNascimento').value,
                tipo: document.getElementById('tipo').value,
                foto: fotoProcessada
            };

            // Se estiver editando e não selecionou nova foto, mantém a foto atual
            if (this.form.dataset.id && !file) {
                const aniversarianteAtual = this.aniversariantes.find(a => a.id === this.form.dataset.id);
                if (aniversarianteAtual) {
                    dados.foto = aniversarianteAtual.foto;
                }
            }

            try {
                if (this.form.dataset.id) {
                    this.editarAniversariante(dados);
                } else {
                    this.adicionarAniversariante(dados);
                }

                this.form.reset();
                delete this.form.dataset.id;
                document.querySelector('.btn-cadastrar').textContent = 'Cadastrar';
            } catch (error) {
                alert('Erro ao salvar: A imagem pode estar muito grande. Tente uma imagem menor ou com menor resolução.');
                console.error('Erro ao salvar:', error);
            }
        };

        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                processarSubmit(e.target.result);
            };
            reader.readAsDataURL(file);
        } else {
            processarSubmit();
        }
    }

    adicionarAniversariante(dados) {
        this.aniversariantes.push(dados);
        this.salvarDados();
        this.renderizarLista();
        this.atualizarEstatisticas();
        this.verificarAniversarianteDoDia(true);
    }

    editarAniversariante(dados) {
        const index = this.aniversariantes.findIndex(a => a.id === dados.id);
        if (index !== -1) {
            this.aniversariantes[index] = dados;
            this.salvarDados();
            this.renderizarLista();
            this.atualizarEstatisticas();
        }
    }

    excluirAniversariante(id) {
        const modal = document.createElement('div');
        modal.className = 'modal-confirmacao';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Confirmar Exclusão</h3>
                <p>Tem certeza que deseja excluir este aniversariante?</p>
                <div class="modal-buttons">
                    <button class="btn-cancelar">Cancelar</button>
                    <button class="btn-confirmar">Confirmar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        modal.querySelector('.btn-cancelar').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        modal.querySelector('.btn-confirmar').addEventListener('click', () => {
            this.aniversariantes = this.aniversariantes.filter(a => a.id !== id);
            this.salvarDados();
            this.renderizarLista();
            this.atualizarEstatisticas();
            document.body.removeChild(modal);
        });
    }

    calcularIdade(dataNascimento) {
        const hoje = new Date();
        const nascimento = new Date(dataNascimento + 'T00:00:00');
        let idade = hoje.getFullYear() - nascimento.getFullYear();
        const mesAtual = hoje.getMonth() + 1;
        const mesNascimento = nascimento.getMonth() + 1;
        
        if (mesAtual < mesNascimento || 
            (mesAtual === mesNascimento && hoje.getDate() < nascimento.getDate())) {
            idade--;
        }
        return idade;
    }

    formatarData(data) {
        // Ajustando para considerar o fuso horário local
        const dataObj = new Date(data + 'T00:00:00');
        return dataObj.toLocaleDateString('pt-BR');
    }

    verificarAniversarianteDoDia(forcarVerificacao = false) {
        const hoje = new Date();
        const aniversariantesHoje = this.aniversariantes.filter(a => {
            const dataNasc = new Date(a.dataNascimento + 'T00:00:00');
            return dataNasc.getDate() === hoje.getDate() && 
                   dataNasc.getMonth() === hoje.getMonth();
        });

        const ultimaNotificacao = localStorage.getItem('ultimaNotificacao');
        const dataHoje = hoje.toDateString();

        if (aniversariantesHoje.length > 0 && (forcarVerificacao || ultimaNotificacao !== dataHoje)) {
            const tocarSomEMostrarAlertas = async () => {
                try {
                    const somConfete = document.getElementById('somConfete');
                    somConfete.volume = 0.5; // Volume mais baixo para o som de festa
                    
                    // Toca o som de alerta
                    this.somAlerta.currentTime = 0;
                    await this.somAlerta.play();
                    
                    // Mostra os alertas e dispara confetes para cada aniversariante
                    aniversariantesHoje.forEach(aniversariante => {
                        const idade = this.calcularIdade(aniversariante.dataNascimento);
                        alert(`🎉 Hoje é dia de comemoração!\n${aniversariante.nome} está completando ${idade} anos!`);
                        
                        // Toca o som de festa junto com os confetes
                        somConfete.currentTime = 0;
                        somConfete.play();
                        
                        // Dispara confetes coloridos
                        confetti({
                            particleCount: 100,
                            spread: 70,
                            origin: { y: 0.6 },
                            colors: ['#D4A373', '#CCD5AE', '#FAEDCD', '#E9DAC1']
                        });

                        // Dispara mais confetes após um pequeno delay
                        setTimeout(() => {
                            somConfete.currentTime = 0;
                            somConfete.play();
                            confetti({
                                particleCount: 50,
                                angle: 60,
                                spread: 55,
                                origin: { x: 0 }
                            });
                            confetti({
                                particleCount: 50,
                                angle: 120,
                                spread: 55,
                                origin: { x: 1 }
                            });
                        }, 250);
                    });
                    
                    if (!forcarVerificacao) {
                        localStorage.setItem('ultimaNotificacao', dataHoje);
                    }
                } catch (error) {
                    console.error("Erro:", error);
                    // Mesmo com erro no som, mostra alertas e confetes
                    aniversariantesHoje.forEach(aniversariante => {
                        const idade = this.calcularIdade(aniversariante.dataNascimento);
                        alert(`🎉 Hoje é dia de comemoração!\n${aniversariante.nome} está completando ${idade} anos!`);
                        
                        confetti({
                            particleCount: 100,
                            spread: 70,
                            origin: { y: 0.6 },
                            colors: ['#D4A373', '#CCD5AE', '#FAEDCD', '#FFD700']
                        });
                    });
                }
            };

            tocarSomEMostrarAlertas();
        }
    }

    configurarFiltros() {
        document.querySelectorAll('.filtro-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filtro-btn').forEach(b => b.classList.remove('ativo'));
                e.target.classList.add('ativo');
                this.renderizarLista(e.target.dataset.filtro);
            });
        });
    }

    renderizarLista(filtro = 'todos') {
        let aniversariantesFiltrados = this.aniversariantes;
        if (filtro !== 'todos') {
            aniversariantesFiltrados = this.aniversariantes.filter(a => a.tipo === filtro);
        }

        this.lista.innerHTML = aniversariantesFiltrados
            .sort((a, b) => new Date(a.dataNascimento) - new Date(b.dataNascimento))
            .map(aniversariante => `
                <div class="card-aniversariante" data-tipo="${aniversariante.tipo}">
                    <div class="foto-aniversariante ${!aniversariante.foto ? 'sem-foto' : ''}">
                        ${aniversariante.foto 
                            ? `<img src="${aniversariante.foto}" alt="Foto de ${aniversariante.nome}">`
                            : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="info-aniversariante">
                        <h3>${aniversariante.nome}</h3>
                        <p>Data: ${this.formatarData(aniversariante.dataNascimento)}</p>
                        <p>Idade: ${this.calcularIdade(aniversariante.dataNascimento)} anos</p>
                        <p>Tipo: ${aniversariante.tipo.charAt(0).toUpperCase() + aniversariante.tipo.slice(1)}</p>
                    </div>
                    <div class="acoes">
                        <button onclick="gerenciador.prepararEdicao('${aniversariante.id}')" class="btn-editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="gerenciador.excluirAniversariante('${aniversariante.id}')" class="btn-excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button onclick="gerenciador.compartilharAniversariante('${aniversariante.id}')" class="btn-compartilhar">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
            `).join('');

        this.atualizarProximoAniversario();
        this.atualizarEstatisticas();
    }

    prepararEdicao(id) {
        const aniversariante = this.aniversariantes.find(a => a.id === id);
        if (aniversariante) {
            document.getElementById('nome').value = aniversariante.nome;
            document.getElementById('dataNascimento').value = aniversariante.dataNascimento;
            document.getElementById('tipo').value = aniversariante.tipo;
            // Não podemos definir o valor do input file por segurança
            this.form.dataset.id = id;
            document.querySelector('.btn-cadastrar').textContent = 'Atualizar';
        }
    }

    salvarDados() {
        localStorage.setItem('aniversariantes', JSON.stringify(this.aniversariantes));
    }

    atualizarProximoAniversario() {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zera as horas para comparação precisa
        
        let proximoAniversario = null;
        let menorDiferenca = Infinity;
        
        this.aniversariantes.forEach(aniversariante => {
            const dataAniversario = new Date(aniversariante.dataNascimento);
            dataAniversario.setHours(0, 0, 0, 0);
            
            // Ajusta para o ano atual
            dataAniversario.setFullYear(hoje.getFullYear());
            
            // Se a data já passou este ano, ajusta para o próximo ano
            if (dataAniversario < hoje) {
                dataAniversario.setFullYear(hoje.getFullYear() + 1);
            }
            
            const diferenca = dataAniversario - hoje;
            if (diferenca < menorDiferenca) {
                menorDiferenca = diferenca;
                proximoAniversario = {
                    nome: aniversariante.nome,
                    data: dataAniversario
                };
            }
        });

        if (proximoAniversario) {
            document.getElementById('proximoNome').textContent = proximoAniversario.nome;
            this.iniciarContagem(proximoAniversario.data);
        }
    }

    iniciarContagem(dataAlvo) {
        const atualizarContagem = () => {
            const agora = new Date();
            // Zera as horas da data atual
            agora.setHours(0, 0, 0, 0);
            
            // Ajusta a data alvo para meia-noite
            const dataAlvoAjustada = new Date(dataAlvo);
            dataAlvoAjustada.setHours(0, 0, 0, 0);
            
            // Calcula a diferença em milissegundos e converte para dias
            const diferencaEmMilissegundos = dataAlvoAjustada - agora;
            const diferencaEmDias = diferencaEmMilissegundos / (1000 * 60 * 60 * 24);
            
            // Arredonda para cima e adiciona 1 para incluir o dia atual
            const dias = Math.floor(diferencaEmDias) + 1;
            
            // Calcula as horas restantes do dia atual
            const horasAtual = new Date().getHours();
            const horas = 23 - horasAtual;
            
            // Calcula os minutos restantes da hora atual
            const minutosAtual = new Date().getMinutes();
            const minutos = 59 - minutosAtual;
            
            document.getElementById('dias').textContent = dias;
            document.getElementById('horas').textContent = horas;
            document.getElementById('minutos').textContent = minutos;
        };

        atualizarContagem();
        setInterval(atualizarContagem, 1000 * 60); // Atualiza a cada minuto
    }

    buscarAniversariantes() {
        const termoBusca = this.campoBusca.value.toLowerCase();
        const aniversariantesFiltrados = this.aniversariantes.filter(aniversariante => 
            aniversariante.nome.toLowerCase().includes(termoBusca)
        );

        this.lista.innerHTML = aniversariantesFiltrados
            .map(aniversariante => `
                <div class="card-aniversariante" data-tipo="${aniversariante.tipo}">
                    <div class="foto-aniversariante ${!aniversariante.foto ? 'sem-foto' : ''}">
                        ${aniversariante.foto 
                            ? `<img src="${aniversariante.foto}" alt="Foto de ${aniversariante.nome}">`
                            : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="info-aniversariante">
                        <h3>${aniversariante.nome}</h3>
                        <p>Data: ${this.formatarData(aniversariante.dataNascimento)}</p>
                        <p>Idade: ${this.calcularIdade(aniversariante.dataNascimento)} anos</p>
                        <p>Tipo: ${aniversariante.tipo.charAt(0).toUpperCase() + aniversariante.tipo.slice(1)}</p>
                    </div>
                    <div class="acoes">
                        <button onclick="gerenciador.prepararEdicao('${aniversariante.id}')" class="btn-editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="gerenciador.excluirAniversariante('${aniversariante.id}')" class="btn-excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button onclick="gerenciador.compartilharAniversariante('${aniversariante.id}')" class="btn-compartilhar">
                            <i class="fas fa-share-alt"></i>
                        </button>
                    </div>
                </div>
            `).join('');

        this.atualizarEstatisticas();
    }

    atualizarEstatisticas() {
        // Atualiza o total
        const total = this.aniversariantes.length;
        document.querySelector('.stat-card:nth-child(1) .stat-numero').textContent = total;

        // Atualiza o número de familiares
        const familiares = this.aniversariantes.filter(a => a.tipo === 'familiar').length;
        document.querySelector('.stat-card:nth-child(2) .stat-numero').textContent = familiares;

        // Atualiza o número de amigos
        const amigos = this.aniversariantes.filter(a => a.tipo === 'amigo').length;
        document.querySelector('.stat-card:nth-child(3) .stat-numero').textContent = amigos;

        // Atualiza o número de pets
        const pets = this.aniversariantes.filter(a => a.tipo === 'pet').length;
        document.querySelector('.stat-card:nth-child(4) .stat-numero').textContent = pets;
    }

    // Adicionar o método de exportação
    exportarParaCalendario() {
        // Cria o conteúdo do arquivo .ics
        let conteudoICS = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'PRODID:-//Agenda de Comemorações//PT-BR',
            'X-WR-CALNAME:Aniversários'
        ];

        this.aniversariantes.forEach(aniversariante => {
            const dataNasc = new Date(aniversariante.dataNascimento);
            const ano = new Date().getFullYear();
            const mes = String(dataNasc.getMonth() + 1).padStart(2, '0');
            const dia = String(dataNasc.getDate()).padStart(2, '0');
            
            conteudoICS = conteudoICS.concat([
                'BEGIN:VEVENT',
                `UID:${aniversariante.id}@aniversarios`,
                `DTSTAMP:${ano}${mes}${dia}T000000Z`,
                `DTSTART;VALUE=DATE:${ano}${mes}${dia}`,
                'RRULE:FREQ=YEARLY',
                `SUMMARY:🎂 Aniversário - ${aniversariante.nome}`,
                `DESCRIPTION:Aniversário de ${aniversariante.nome}\\nTipo: ${aniversariante.tipo}`,
                'TRANSP:TRANSPARENT',
                'SEQUENCE:0',
                'STATUS:CONFIRMED',
                'END:VEVENT'
            ]);
        });

        conteudoICS.push('END:VCALENDAR');
        const conteudoFinal = conteudoICS.join('\r\n');

        try {
            const blob = new Blob([conteudoFinal], { type: 'text/calendar;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'aniversarios.ics';
            
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(link);
            }, 100);

            alert('Calendário exportado com sucesso!\n\nPara importar:\n1. Abra o Calendário do Windows\n2. Clique em "Adicionar Calendário"\n3. Escolha "Arquivo" e selecione o arquivo baixado');
        } catch (error) {
            console.error('Erro ao exportar:', error);
            alert('Houve um erro ao exportar o calendário. Por favor, tente novamente.');
        }
    }

    exportarBackup() {
        const dados = JSON.stringify(this.aniversariantes);
        const blob = new Blob([dados], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_aniversarios_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }

    async solicitarPermissaoNotificacao() {
        if ('Notification' in window) {
            const permissao = await Notification.requestPermission();
            if (permissao === 'granted') {
                // Configurar notificações
            }
        }
    }

    compartilharAniversariante(id) {
        const aniversariante = this.aniversariantes.find(a => a.id === id);
        if (!aniversariante) return;

        if (navigator.share) {
            navigator.share({
                title: 'Aniversário',
                text: `${aniversariante.nome} faz aniversário em ${this.formatarData(aniversariante.dataNascimento)}!`,
                url: window.location.href
            }).catch(err => {
                console.error('Erro ao compartilhar:', err);
                alert('Não foi possível compartilhar. Tente copiar o link manualmente.');
            });
        } else {
            // Fallback para navegadores que não suportam a API Share
            const texto = `${aniversariante.nome} faz aniversário em ${this.formatarData(aniversariante.dataNascimento)}!`;
            if (navigator.clipboard) {
                navigator.clipboard.writeText(texto)
                    .then(() => alert('Texto copiado para a área de transferência!'))
                    .catch(() => alert('Não foi possível copiar o texto.'));
            } else {
                alert(texto);
            }
        }
    }
}

const gerenciador = new GerenciadorAniversarios();