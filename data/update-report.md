# Data update 2026-11-07.3

Generated 2026-11-07T11:34:51Z.
Game: version 1.2.2, Regulation M-C.

## Contents

- Pokédex entries in Champions: 247
- Forms in Champions (incl. Megas and variants): 397
- Reference forms (family members outside Champions): 270
- Evolution families: 209
- Moves available in Champions: 512
- Moves changed from the main series: 36
- Abilities: 218
- Items in Champions: 166
- Learnset entries: 16073
- Learnset entries new in Champions: 110
- Forms with Pokédex entries of their own: 178
- Spanish Pokédex entries from WikiDex (games before X and Y): 3573
- Shiny artwork lined up with the regular art: 149
- Fan art (data/overrides/art.json): 0

## Changes since the previous update

### Changed: dex-entries (154)

- abra
- aron
- azurill
- bagon
- basculin
- bayleef
- beldum
- bellossom
- bellsprout
- bisharp
- budew
- bulbasaur
- buneary
- carvanha
- charmander
- charmeleon
- chikorita
- chimchar
- chingling
- clefairy
- cleffa
- combusken
- cottonee
- cranidos
- croagunk
- croconaw
- cubchoo
- cyndaquil
- deino
- dewott
- dragonair
- dratini
- drilbur
- duosion
- eelektrik
- eevee
- ekans
- electrike
- feebas
- flaaffy
- gabite
- gastly
- gible
- girafarig
- gligar
- gloom
- golett
- grotle
- grovyle
- growlithe
- gulpin
- gurdurr
- haunter
- hippopotas
- houndour
- igglybuff
- ivysaur
- jigglypuff
- kadabra
- kakuna
- kirlia
- krokorok
- lairon
- lampent
- larvesta
- larvitar
- litwick
- luxio
- machoke
- machop
- magikarp
- mankey
- mareep
- marill
- marshtomp
- meditite
- meowth
- metang
- mime-jr
- monferno
- mudkip
- munchlax
- munna
- numel
- oddish
- onix
- oshawott
- panpour
- pansage
- pansear
- patrat
- pawniard
- pichu
- pidgeotto
- pidgey
- pignite
- piloswine
- pineco
- piplup
- poliwag
- poliwhirl
- poliwrath
- primeape
- prinplup
- pupitar
- purrloin
- quilava
- ralts
- rhydon
- rhyhorn
- riolu
- roselia
- sandile
- scraggy
- scyther
- servine
- shelgon
- shieldon
- shinx
- shuppet
- slowpoke
- sneasel
- snivy
- snorunt
- snover
- solosis
- spinarak
- squirtle
- stantler
- staravia
- starly
- staryu
- swablu
- swinub
- tepig
- timburr
- torchic
- totodile
- treecko
- trubbish
- turtwig
- tynamo
- vanillish
- vanillite
- venipede
- vulpix
- wartortle
- weedle
- weepinbell
- whirlipede
- wingull
- yamask
- zorua
- zweilous


## Sources

- [Pokémon Champions datamine (Project Pokémon)](https://github.com/projectpokemon/champout) at `50e7233b78c3`
- [PokéAPI data](https://github.com/PokeAPI/pokeapi) at `6ea97b5641fa`
- [PokéAPI sprites](https://github.com/PokeAPI/sprites) at `1b3b7c0a538d`
- [Pokémon Showdown](https://github.com/smogon/pokemon-showdown) at `567c1cedddea`
- [Pokémon main series text dumps (tanripj)](https://github.com/tanripj/pokemon_text_dumps) at `d67e1c3cbcf5`
- [Brilliant Diamond and Shining Pearl text dumps (tanripj)](https://github.com/tanripj/bdsp_text_dumps) at `1f94006a6838`
- [Pokémon Legends: Z-A text dump with labels (CPokemon)](https://github.com/CPokemon/plza-text) at `3f149c41285b`
- [PKHeX (game form tables)](https://github.com/kwsch/PKHeX) at `0660d1e1f492`
- [Pokémon JSON API by towakey (Japanese Pokédex text per form)](https://github.com/towakey/pokedex) at `142c54d3f6a8`
- [WikiDex (Spanish Pokédex entries for the games before X and Y)](https://www.wikidex.net) at `2026-11-07`

## Things to check (1)

Nothing here stops the app from working; these are spots where the sources disagree or data is missing.

- scarlet/violet: 1 entries sit on different lines in the two versions, so entries missing from one weren't taken from the other

## Learnsets that differ from PokéAPI's copy of the Champions learnsets (32)

- charizard (+1/−0)
- pinsir (+1/−0)
- feraligatr (+1/−0)
- politoed (+0/−1)
- scizor (+1/−0)
- skarmory (+1/−0)
- sceptile (+1/−0)
- blaziken (+1/−0)
- mawile (+3/−0)
- sharpedo (+1/−0)
- banette (+1/−0)
- absol (+1/−0)
- garchomp (+1/−0)
- weavile (+1/−0)
- gliscor (+1/−0)
- gallade (+1/−0)
- samurott (+1/−0)
- samurott-hisui (+1/−0)
- liepard (+1/−0)
- excadrill (+1/−0)
- beartic (+1/−0)
- pangoro (+1/−0)
- aegislash (+1/−0)
- malamar (+1/−0)
- barbaracle (+1/−0)
- mimikyu (+1/−0)
- kleavor (+1/−0)
- sneasler (+1/−0)
- meowscarada (+1/−0)
- houndstone (+1/−0)
- kingambit (+1/−0)
- archaludon (+1/−2)

## Move targets the game files give differently from PokéAPI (the game's are used) (3)

- `coaching`: all-allies in the game files, user-and-allies in PokéAPI
- `matcha-gotcha`: all-opponents in the game files, selected-pokemon in PokéAPI
- `milk-drink`: user-or-ally in the game files, user in PokéAPI

## Pokédex colours Pokémon Showdown gives differently from PokéAPI (Showdown's are used) (7)

- `arctibax`: blue in Pokémon Showdown, gray in PokéAPI
- `baxcalibur`: blue in Pokémon Showdown, gray in PokéAPI
- `ceruledge`: purple in Pokémon Showdown, blue in PokéAPI
- `gimmighoul`: red in Pokémon Showdown, brown in PokéAPI
- `quaxly`: blue in Pokémon Showdown, white in PokéAPI
- `sneasler`: blue in Pokémon Showdown, gray in PokéAPI
- `vivillon`: pink in Pokémon Showdown, white in PokéAPI

## Pokédex entries of single forms found in each game (14)

- legends-za: 506 entries placed by label
- sun: 159 entries placed
- moon: 159 entries placed
- sword: 338 entries placed, 1 from data/overrides/dex-entries.json
- shield: 335 entries placed, 3 from the same line in the other version, 1 from data/overrides/dex-entries.json
- legends-arceus: 127 entries placed
- scarlet: 445 entries placed, 3 from data/overrides/dex-entries.json, 3 not found in the dump (reference:vulpix-alola, reference:meowth-galar, reference:slowpoke-galar)
- violet: 446 entries placed, 3 from data/overrides/dex-entries.json, 2 not found in the dump (reference:meowth-galar, reference:slowpoke-galar)
- ultra-sun: 249 entries placed by position
- ultra-moon: 249 entries placed by position
- lets-go-pikachu: 90 entries placed by position
- lets-go-eevee: 90 entries placed by position
- brilliant-diamond: 212 entries placed by number
- shining-pearl: 212 entries placed by number

## Forms whose regular and shiny art aren't the same drawing (better art welcome) (6)

- castform-rainy
- floette-eternal
- sliggoo
- squawkabilly-blue-plumage
- squawkabilly-white-plumage
- squawkabilly-yellow-plumage

## Damage calculator: taken from the calculator's Scarlet and Violet data (1)

- Move `pound`

## Damage calculator: where the game data and Smogon's calculator disagree (1)

- `growth`: type grass (calculator: normal). The game data is used.
