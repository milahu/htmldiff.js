import {createToken, findMatchingBlocks, htmlToTokens} from "../dist/htmldiff.js";


describe('htmlToTokens', function(){
  var cut, res, tokenize;

  beforeEach(function(){
    cut = htmlToTokens;

    tokenize = function(tokens){
      return tokens.map(function(token){
        return createToken(token);
      });
    };
  });

  it('should be a function', function(){
    expect(htmlToTokens).is.a('function');
  });

  describe('when called with text', function(){
    beforeEach(function(){
      res = htmlToTokens('this is a test');
    });

    it('should return 4', function(){
      expect(res.length).to.equal(7);
    });
  });

  describe('when called with html', function(){
    beforeEach(function(){
      res = htmlToTokens('<p>this is a <strong>test</strong></p>');
    });

    it('should return 11', function(){
      expect(res.length).to.equal(11);
    });

    it('should remove any html comments', function(){
      res = htmlToTokens('<p> this is <!-- a comment! --> </p>');
      expect(res.length).to.equal(8);
    });
  });

  it('should identify contiguous whitespace as a single token', function(){
    expect(htmlToTokens('a   b')).to.eql(tokenize(['a', '   ', 'b']));
  });

  it('should identify a single space as a single token', function(){
    expect(htmlToTokens(' a b ')).to.eql(tokenize([' ', 'a', ' ', 'b', ' ']));
  });

  it('should identify self closing tags as tokens', function(){
    expect(htmlToTokens('<p>hello</br>goodbye</p>')).eql(
      tokenize(['<p>', 'hello', '</br>', 'goodbye', '</p>']));
  });

  describe('when encountering atomic tags', function(){
    it('should identify an image tag as a single token', function(){
      expect(htmlToTokens('<p><img src="1.jpg"><img src="2.jpg"></p>')).eql(
        tokenize(['<p>', '<img src="1.jpg">', '<img src="2.jpg">', '</p>']));
    });

    it('should identify an iframe tag as a single token', function(){
      expect(htmlToTokens('<p><iframe src="sample.html"></iframe></p>')).eql(
        tokenize(['<p>', '<iframe src="sample.html"></iframe>', '</p>']));
    });

    it('should identify an object tag as a single token', function(){
      var cutResult = htmlToTokens('<p><object><param name="1" /><param name="2" /></object></p>');
      var tokenizeResult = tokenize(
        ['<p>', '<object><param name="1" /><param name="2" /></object>','</p>']);
      expect(cutResult).eql(tokenizeResult);
    });

    it('should identify a math tag as a single token', function(){
      var cutResult = htmlToTokens('<p><math xmlns="http://www.w3.org/1998/Math/MathML">' +
                          '<mi>&#x03C0;<!-- π --></mi>' +
                          '<mo>&#x2062;<!-- &InvisibleTimes; --></mo>' +
                          '<msup><mi>r</mi><mn>2</mn></msup></math></p>');
      var tokenizeResult = tokenize([
        '<p>',
        '<math xmlns="http://www.w3.org/1998/Math/MathML">' +
          '<mi>&#x03C0;<!-- π --></mi>' +
          '<mo>&#x2062;<!-- &InvisibleTimes; --></mo>' +
          '<msup><mi>r</mi><mn>2</mn></msup></math>',
        '</p>'
      ]);
      expect(cutResult).eql(tokenizeResult);
    });

    it('should identify an svg tag as a single token', function(){
      var cutResult = htmlToTokens('<p><svg width="100" height="100">' +
                          '<circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" ' +
                          'fill="yellow" /></svg></p>');
      var tokenizeResult = tokenize([
        '<p>',
        '<svg width="100" height="100">' +
          '<circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />' +
          '</svg>',
        '</p>'
      ]);
      expect(cutResult).eql(tokenizeResult);
    });

    it('should identify anchor tags as one token', function() {
      expect(htmlToTokens('<a src="1">text</a>')).eql(tokenize(['<a src="1">text</a>']));
    });

    it('should identify a script tag as a single token', function(){
      expect(htmlToTokens('<p><script>console.log("hi");</script></p>')).eql(
        tokenize(['<p>', '<script>console.log("hi");</script>', '</p>']));
    });
  });
});
