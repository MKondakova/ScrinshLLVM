# ScrinchToLLVM

## Запуск 
- Для получения исполняемого файла нужно выполнить ```tsc && node src/main.js && clang examples/out.ll``` 
- Для использования функции в программе на Си нужно выполнить  
in.o out.o && ./res && cd ..```
```
tsc && node src/main.js examples/testSchema.txt && cd examples/ && clang out.ll -c && gcc -c main.c && gcc -o res main.o out.o && ./res && cd ..

```