# Runner source architecture

runner の `src` は、小さな core と gateway に分ける。

```txt
src/
  cli.ts
  core/
    domain/  entity、value-object、enum。runner が扱う状態と値だけを置く。
    app/     usecase、application service、policy、routing、contract、settings
    port/    usecase が必要とする抽象 interface
  gateway/
    inbound/  CLI や将来の webhook controller など、外から core を呼ぶ入口
    outbound/ GitHub、git、AI CLI、config、filesystem など、外部へ出る実装
```

依存方向:

```txt
gateway/inbound -> core/app -> core/domain
core/app -> core/port
gateway/inbound -> gateway/outbound
gateway/outbound -> core/port and core/domain types
```

`core` は `gateway` を import しない。outbound 実装は inbound adapter で組み立てる。

`core/domain` には GitHub / git / AI CLI / config schema / DTO を置かない。
runner の安全制御や command routing は domain entity そのものではないため、`core/app`
に置く。

`core/port` は usecase が必要とする抽象 interface を置く場所。実装は
`gateway/outbound` に置く。YAML/Zod config schema や prompt 文字列化は gateway 側の責務。
