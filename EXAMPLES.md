# Examples

`singleflight-modern` is an independent package. It is not affiliated with `inflight` or its maintainers.

## `inflight` to `singleflight-modern`

```ts
import { createSingleFlight } from "singleflight-modern";

const users = createSingleFlight<string, User>();
const user = await users.do("user:42", ({ signal }) => fetchUser("42", { signal }));
```
