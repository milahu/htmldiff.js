# htmldiff.js

Diff and markup HTML with `<ins>` and `<del>` tags.


## Origin

Quote from the original source of this fork:

*`htmldiff.js` is a TypeScript port of [https://github.com/myobie/htmldiff](https://github.com/myobie/htmldiff) by
[Keanu Lee](http://keanulee.com) at [Inkling](https://www.inkling.com/) via [htmldiff.js](https://github.com/nataliesantiago/htmldiff.js).*

**htmldiff.js** is based on [this fork](https://github.com/inkling/htmldiff.js) and adds a few things:

- Diffing of video, math, widget, iframe, img and svg tags.
- Ability to set atomic tags via the API.
- A command line interface.
- TypeScript support.
- Better documentation.

See also *Credits* below.

## Description

htmldiff takes two HTML snippets or files and marks the differences between them with
`<ins>` and `<del>` tags. The diffing understands HTML so it doesn't do a pure text diff,
instead it will insert the appropriate tags for changed/added/deleted text nodes, single 
tags or tag hierarchies.

The module can be used as module in Node.js, with RequireJS, or even just as a script tag.

## API

The exports can be found in [`dist/htmldiff.d.ts`](https://github.com/mblink/htmldiff.js/blob/master/dist/htmldiff.d.ts)

### Diff Parameters

- `before` (string) is the original HTML text.
- `after` (string) is the HTML text after the changes have been applied.

The return value is a string with the diff result, marked by `<ins>` and `del` tags. The 
function has three optional parameters. If an empty string or `null` is used for any
of these three parameters it will be ignored:

- `className` (string) className will be added as a class attribute on every inserted 
  `<ins>` and `<del>` tag.
- `dataPrefix` (string) The data prefix to use for data attributes. The so called *operation 
  index data attribute* will be named `data-${dataPrefix-}operation-index`. If not used, 
  the default attribute name `data-operation-index` will be added on every inserted 
  `<ins>` and `<del>` tag. The value of this attribute is an auto incremented counter. 
- `atomicTags` (string) Comma separated list of tag names. The list has to be in the form 
  `tag1,tag2,...` e. g. `head,script,style`. An atomic tag is one whose child nodes should 
  not be compared - the entire tag should be treated as one token. This is useful for tags 
  where it does not make sense to insert `<ins>` and `<del>` tags. If not used, the default 
  list will be used:
  `iframe,object,math,svg,script,video,head,style`.


### Example

TypeScript:

```javascript
  import diff = require("node-htmldiff");

  console.log(diff("<p>This is some text</p>", "<p>That is some more text</p>", "myClass"));
```

Result:

```html
<p><del data-operation-index="1" class="myClass">This</del><ins data-operation-index="1" class="myClass">That</ins> is some<ins data-operation-index="3" class="myClass"> more</ins> text.</p>
```

## Development
* `npm install` to install dependencies
* `npm run lint` to ESLint the TypeScript
* `npm run make` to compile the TypeScript
* `npm run test` to run the tests

## Credits

This module wouldn't have been possible without code from the following projects/persons:

- Original project: [The Network Inc.](http://www.tninetwork.com), [Github](https://github.com/tnwinc/htmldiff.js)
- Massive improvements of the original code: [Inkling](https://www.inkling.com), [Github](https://github.com/inkling/htmldiff.js)
- Support of more tags: Ian White, [Github](https://github.com/ian97531)


## License

MIT © [idesis GmbH](http://www.idesis.de), Rellinghauser Straße 334F, D-45136 Essen

See the `LICENSE` file for details.
