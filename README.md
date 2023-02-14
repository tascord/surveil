# surveil
Not scryfall i promise

### How to do the thing
1. `git clone https://github.com/tascord/surveil`
2. `cd surveil`
3. `npm i`
4. `touch mapper.js`
5. `vim mapper.js`, `...`, `:wq`
8. `tsc -p .`
9. `node dist/index.js`

### What and why
Want to make a scryfall like db query tool thats extendable as your data changes. 
Seems a bit silly but kinda fun also

### Aims going forward
Eventually just have an `npm init surveil` type system, where you just present your data file, configure mappings through code or cli prompt, and then you have an automatic api immediately queryable.
Also hoping I can throw together a web dashboard thats easily connected for fun.
