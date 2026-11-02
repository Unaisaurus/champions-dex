# Battle mechanics

Each battle mechanic (Mega Evolution now; Terastallization, Dynamax and Z-Moves
later) lives in its own file here and plugs into the rest of the app through
the `MechanicModule` interface in `types.ts`.

## How a mechanic is switched on

`public/data/rules.json` lists the mechanics Champions currently allows:

```json
"mechanics": { "mega": true, "tera": false, "dynamax": false, "z-moves": false }
```

A module only runs when its `id` is `true` there. So a module can be written in
advance and switched on with a data update the day Champions enables it.

## Adding a new mechanic (for example Terastallization)

1. Create `tera.ts` exporting a `MechanicModule` with `id: 'tera'`.
2. If team members need extra data (a Tera type), store it under
   `member.mechanics.tera` and provide `createMemberData`. Saved teams already
   have a `mechanics` field, so no storage migration is needed.
3. Add checks with `validateMember` / `validateTeam`. Each issue needs a message
   in `translations/<language>/ui.json` under `validation.<code>`.
4. Register the module in `registry.ts`.
5. Write tests next to it (`tera.test.ts`).
6. Set `"tera": true` in rules.json once Champions supports it.

Rules that differ in Champions should only be implemented once they're known
from the game itself — never assumed from the main series.
