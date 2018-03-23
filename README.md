![wonder](wonder.png?raw=true)

[![NPM](https://nodei.co/npm/wonderlang.png?downloads=true)](https://npmjs.org/package/wonderlang)

[![NPM](https://nodei.co/npm-dl/wonderlang.png?months=6&height=3)](https://nodei.co/npm/wonderlang/)

Are you a functional programming elitist? Are you a lazy coder? Do you just wish there was a wonderful programming language? If so, then Wonder is for you.

Wonder is a general-purpose functional programming language influenced by countless other programming languages, especially Haskell, Lisp, and Javascript. Although meant to be a practical language, Wonder can become quite obfuscated at times.

For installation/docs, visit the [wiki](https://github.com/wonderlang/wonder/wiki).

# Features
- Mostly functional, with some imperative/object-oriented structures
- Lazily evaluated
- Fresh syntax design
- Dynamically and weakly typed
- Implements a zero-indexed version of de Bruijn indices
- Code as data
- Pattern matching support
- Polish notation
- Arbitrary decimal precision support (note that trig functions are limited to 1000 digits of precision)
- Simple package system
- Easy installation via Node.js and NPM

# Examples
"Hello, world!":
```
"Hello, world!"
```

Recursive Fibonacci sequence with memoization:
```
f\ .{
  0\ 0;
  1\ 1;
  @(
    f\ set #[#0 x] f;
    x
  )x\ (+ f - #0 1) f - #0 2
};
map #f rng 1 50
```

Alternative Fibonacci sequence:
```
tk 100 (genc@
  round * #phi #0
) 1
```

FizzBuzz:
```
(join "
") (map @
  (
    and % #0 3 % #0 5
      ? #0
      ? (con (
          % #0 3
            ? ""
            ? "fizz"
        )) (
          % #0 5
            ? ""
            ? "buzz"
        )
  )
) rng 1 101
```

Quine (run with `--noexpr` flag):
```
f\ @ol ["f\ ";f;";f0"];f0
```

∞ x ∞ Matrix:
```
rpt oo rpt oo 1
```

Truth Machine (enter nothing for falsy and anything for truthy):
```
t\ @(
  #0
    ? t ol 1
    ? 0
);
t rl ()
```
You can find some PPCG.SE Wonder submissions [here](http://codegolf.stackexchange.com/search?q=wonder+url%3A%22https%3A%2F%2Fgithub.com%2Fwonderlang%2Fwonder%22+is%3Aanswer).
