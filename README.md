Projeto ponto digital.

O projeto consiste em um sistema de ponto digital simples. Podendo:

-bater ponto de entrada e saída;
-cadastrar novos usuarios(decidindo horario de entrada e saída);
-impedir que pontos de saída sejam registrados antes do horario definido;
-ver quem nao bateu ponto;

Coisas a serem incluidas em breve:
- historico de pontos;
- marcar com atraso usuarios que batem ponto de entrada fora da tolerancia;
- autenticação para entrar no dashboard;

Tecnologias usadas:

-express;
-socket.io;
-HTML básico;
-CSS;
-javascript;

Como acionar servidor:

1.copiar projeto com:
$ git clone https://github.com/papagaiogamer/TCC.git

2.Na pasta com o projeto, abra o terminal e digite:
$ npm run dev

Após isso, a aplicaçao vai estar funcionando na porta 3000, porta pre-programada.

Para acessar pagina de bater ponto, vá em : localhost:3000/
Para acessar dashboard, apenas adicione /dashboard 
