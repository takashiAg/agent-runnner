# Runner source architecture

runner の `src` は、小さな core と gateway に分ける。

```txt
src/
  cli.ts
  core/
    domain/  entity、value-object、enum、domain policy / service
    app/     usecase、application service、contract、config、gateway port
  gateway/
    inbound/  CLI や将来の webhook controller など、外から core を呼ぶ入口
    outbound/ GitHub、git、AI CLI、config、filesystem など、外部へ出る実装
```

依存方向:

```txt
gateway/inbound -> core/app -> core/domain
gateway/inbound -> gateway/outbound
gateway/outbound -> core/app ports and core/domain types
```

`core` は `gateway` を import しない。outbound 実装は inbound adapter で組み立てる。
