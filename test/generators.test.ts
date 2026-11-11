import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fakeChineseIdCard,
  fakeCreditCard,
  generatePassword,
  lorem,
  nanoId,
  pickN,
  randomInRange,
  rollDice,
  scorePassword,
  ulid,
  uuidV4
} from '../src/generators';

describe('password generator', () => {
  it('honors selected character sets, requested length, and ambiguity exclusion', () => {
    for (let index = 0; index < 20; index += 1) {
      const password = generatePassword({
        length: 40,
        lowercase: true,
        uppercase: true,
        digits: true,
        symbols: false,
        excludeAmbiguous: true
      });
      assert.equal(password.length, 40);
      assert.doesNotMatch(password, /[Il1O0oB8Z2S5]/);
      assert.match(password, /[a-z]/);
      assert.match(password, /[A-Z]/);
      assert.match(password, /[0-9]/);
    }
  });

  it('returns no password when no character set is selected', () => {
    assert.equal(generatePassword({
      length: 16,
      lowercase: false,
      uppercase: false,
      digits: false,
      symbols: false,
      excludeAmbiguous: false
    }), '');
  });

  it('reports weak and strong password buckets', () => {
    assert.ok(scorePassword('abc').score <= 1);
    assert.ok(scorePassword('h9J#4qKz@2Xf!7Wn').score >= 3);
  });
});

describe('ID generators', () => {
  it('generates RFC 4122 version 4 UUID values', () => {
    assert.match(uuidV4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates NanoID and ULID values with their current shapes', () => {
    assert.equal(nanoId(10).length, 10);
    assert.match(nanoId(), /^[0-9A-Za-z_-]{21}$/);
    assert.match(ulid(), /^[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});

describe('Lorem and fake data', () => {
  it('generates the requested English word count and Chinese sentence form', () => {
    assert.equal(lorem('en', 'word', 5).split(' ').length, 5);
    assert.equal(lorem('cn', 'sentence', 1).endsWith('。'), true);
  });

  it('generates Chinese ID card and bank card values with valid checksums', () => {
    const id = fakeChineseIdCard();
    const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    const sum = [...id.slice(0, 17)].reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    assert.equal(id.length, 18);
    assert.equal(id[17], codes[sum % 11]);

    const card = fakeCreditCard('visa');
    const luhn = [...card].reverse().reduce((total, digit, index) => {
      let value = Number(digit);
      if (index % 2 === 1) value = value * 2 > 9 ? value * 2 - 9 : value * 2;
      return total + value;
    }, 0);
    assert.equal(luhn % 10, 0);
  });
});

describe('dice and picker', () => {
  it('keeps dice and random range results inside the requested bounds', () => {
    const dice = rollDice(20, 6);
    assert.equal(dice.length, 20);
    assert.equal(dice.every((value) => value >= 1 && value <= 6), true);

    const range = randomInRange(10, 5, 30);
    assert.equal(range.length, 30);
    assert.equal(range.every((value) => value >= 5 && value <= 10), true);
  });

  it('draws unique list entries and caps the result at the pool size', () => {
    const picked = pickN(['A', 'B', 'C', 'D'], 3);
    assert.equal(picked.length, 3);
    assert.equal(new Set(picked).size, 3);
    assert.equal(pickN(['A', 'B'], 5).length, 2);
  });
});
