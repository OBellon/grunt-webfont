/**
 * grunt-webfont: Node.js engine
 *
 * @requires ttfautohint
 * @author Artem Sapegin (http://sapegin.me)
 */

/*jshint node:true, laxbreak:true, latedef:false */
module.exports = function(grunt, o, done) {
	'use strict';

	var fs = require('fs');
	var path = require('path');
	var async = require('async');
	var _ = require('lodash');
	var StringDecoder = require('string_decoder').StringDecoder;
	var svgicons2svgfont = require('svgicons2svgfont');
	var svg2ttf = require('svg2ttf');
	var ttf2woff = require('ttf2woff');
	var ttf2eot = require('ttf2eot');

	// @todo Append hashes
	// @todo Autohint TTF
	// @todo Fix line height, kerning, sizes, etc. (see generate.py)
	// @todo SVGO for SVG font and for every glyph (?)
	// @todo Tweak SVG (as in FF script)
	// @todo Ligatures

	var result = {
		fontName: o.fontName,
		glyphs: [],
		codepoints: []
	};
	var fonts = {};

	var generators = {
		svg: function(allDone) {
			var steps = 2;
			var done = function() {
				steps--;
				if (steps === 0) allDone(font);
			};

			var font = '';
			var decoder = new StringDecoder('utf8');
			var stream = svgicons2svgfont(o.files, {
				fontName: o.fontName,
				callback: function(glyphs) {
					result.glyphs = _.pluck(glyphs, 'name');
					result.codepoints = _.pluck(glyphs, 'codepoint');
					done();
				}
			});
			stream.on('data', function(chunk) {
				font += decoder.write(chunk);
			});
			stream.on('end', function() {
				fonts.svg = font;
				done();
			});
		},

		ttf: function(done) {
			getFont('svg', function(svgFont) {
				var font = svg2ttf(svgFont, {});
				font = new Buffer(font.buffer);
				fonts.ttf = font;
				done(font);
			});
		},

		woff: function(done) {
			getFont('ttf', function(ttfFont) {
				var font = ttf2woff(new Uint8Array(ttfFont), {});
				font = new Buffer(font.buffer);
				fonts.woff = font;
				done(font);
			});
		},

		eot: function(done) {
			getFont('ttf', function(ttfFont) {
				var font = ttf2eot(new Uint8Array(ttfFont));
				font = new Buffer(font.buffer);
				fonts.eot = font;
				done(font);
			});
		}
	};


	var steps = [];

	// Font types
	o.types.forEach(function(type) {
		steps.push(createFontWriter(type));
	});

	steps.push(allDone);

	// Run!
	async.waterfall(steps);

	function getFont(type, done) {
		if (fonts[type]) {
			done(fonts[type]);
		}
		else {
			generators[type](done);
		}
	}

	function createFontWriter(type) {
		return function(done) {
			getFont(type, function(font) {
				fs.writeFileSync(getFontPath(type), font);
				done();
			});
		};
	}

	function getFontPath(type) {
		return path.join(o.dest, o.fontName + '.' + type);
	}

	function allDone() {
		done(result);
	}

};