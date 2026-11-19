# Como contribuir

Obrigado pelo interesse! Este projeto é mantido por uma pessoa, então contribuições pequenas e bem explicadas são as mais fáceis de aceitar.

*English: issues and pull requests in English are welcome too.*

## Issues

- **Erro ou dado errado:** abra uma issue com o que você esperava, o que aconteceu e, se puder, a fonte oficial que mostra o valor certo (lei, IN ou tabela do SPED, com o artigo).
- **Sugestão:** descreva o problema que ela resolve antes da solução.
- Antes de abrir, procure se já existe uma issue parecida.

## Pull requests

1. Faça um fork e crie uma branch a partir da `main` (`git checkout -b corrige-algo`).
2. Mantenha o PR pequeno e focado em uma coisa.
3. Rode os testes antes de enviar:

   ```bash
   npm ci
   npm run typecheck
   npm test
   ```

4. Escreva mensagens de commit em português, no imperativo ou descritivas, dizendo o que mudou e por quê.
5. Atualize o README e a seção `[Não publicado]` do [CHANGELOG](CHANGELOG.md) quando o comportamento mudar.

Os testes rodam sozinhos no GitHub Actions em todo pull request; o PR só entra com eles passando.

## Padrões do código

- Comentários explicam **por quê**, não o quê.
- Regra de negócio fica em código testado, com a fonte (lei, norma, manual) citada perto dela.
- Nada de chaves, senhas ou dados pessoais no repositório.

## Licença

Ao contribuir, você concorda que sua contribuição seja distribuída sob a mesma licença do projeto (veja [LICENSE](LICENSE)).
