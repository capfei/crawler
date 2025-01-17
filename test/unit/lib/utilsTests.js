// Copyright (c) Microsoft Corporation and others. Licensed under the MIT license.
// SPDX-License-Identifier: MIT

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
const { normalizePath, normalizePaths, trimParents, trimAllParents, extractDate, spawnPromisified } = require('../../../lib/utils')
const { promisify } = require('util')
const execFile = promisify(require('child_process').execFile)
chai.use(chaiAsPromised)
const expect = chai.expect

describe('Utils path functions', () => {
  it('normalizes one path', () => {
    expect(normalizePath('c:\\foo\\bar.txt')).to.equal('c:/foo/bar.txt')
    expect(normalizePath('c:\\foo/bar.txt')).to.equal('c:/foo/bar.txt')
    expect(normalizePath('/foo/bar')).to.equal('/foo/bar')
    expect(normalizePath('')).to.equal('')
    expect(normalizePath(null)).to.be.null
    expect(normalizePath()).to.be.undefined
  })

  it('normalizes several paths', () => {
    const results = normalizePaths(['c:\\foo\\bar1.txt', 'c:\\foo/bar.txt', '/foo/bar', '', null, undefined])
    expect(results).to.have.members(['c:/foo/bar1.txt', 'c:/foo/bar.txt', '/foo/bar', '', null, undefined])
    expect(normalizePaths([]).length).to.equal(0)
    expect(normalizePaths('')).to.equal('')
    expect(normalizePaths(null)).to.be.null
    expect(normalizePaths()).to.be.undefined
  })

  it('trims parents from one path', () => {
    expect(trimParents('/foO/Bar', '/foO')).to.equal('Bar')
    expect(trimParents('/foo/bar', '/foo/')).to.equal('bar')
    expect(trimParents('foo/bar', 'foo/')).to.equal('bar')
    expect(trimParents('/foo/bar', '/')).to.equal('foo/bar')
    expect(trimParents('/foo/bar', '/this')).to.equal('/foo/bar')
    expect(trimParents('/foo', '/foo')).to.equal('')
    expect(trimParents('/foo')).to.equal('/foo')

    expect(trimParents('\\foO\\Bar', '/foO')).to.equal('Bar')
    expect(trimParents('\\foo\\bar', '/foo/')).to.equal('bar')
    expect(trimParents('foo\\bar', 'foo/')).to.equal('bar')
    expect(trimParents('\\foo/bar', '/')).to.equal('foo/bar')
    expect(trimParents('\\foo/bar', '/this')).to.equal('/foo/bar')
    expect(trimParents('\\foo', '/foo')).to.equal('')
    expect(trimParents('\\foo')).to.equal('/foo')
  })

  it('trims parents from multiple paths', () => {
    const results = trimAllParents(['\\foo\\Bar1.txt', '\\foo/bar.txt', '/foo/bar', '', null, undefined], '/foo')
    expect(results).to.have.members(['Bar1.txt', 'bar.txt', 'bar', '', null, undefined])
    expect(trimAllParents([], 'foo').length).to.equal(0)
    expect(trimAllParents('', '')).to.equal('')
    expect(trimAllParents(null, 'foo')).to.be.null
    expect(trimAllParents(undefined, 'foo')).to.be.undefined
  })
})

describe('Util extractDate', () => {
  it('handle null', () => {
    expect(extractDate(null)).to.be.null
  })
  it('invalid date', () => {
    expect(extractDate('Created by Maven 3.5.4')).to.be.null
  })
  it('unparseable date', () => {
    expect(extractDate('Thu Jun 18 20:06:26 CEST 2009')).to.be.null
  })
  it('parseable date found in pom properties', () => {
    const parsed = extractDate('Sat Nov 13 19:35:12 GMT+01:00 2010')
    expect(parsed.toJSDate().toISOString()).to.be.eq('2010-11-13T18:35:12.000Z')
  })
  it('parseable date: ISO format', () => {
    const parsed = extractDate('2010-11-13T18:35:12.000Z')
    expect(parsed.toJSDate().toISOString()).to.be.eq('2010-11-13T18:35:12.000Z')
  })
  it('parseable date: provide additional formats', () => {
    const parsed = extractDate('11-13-2010', ['MM-dd-yyyy', 'EEE MMM d yyyy'])
    expect(parsed.toISODate()).to.be.eq('2010-11-13')
  })
  it('parseable date: SQL formats', () => {
    const parsed = extractDate('2018-05-28 07:26:25 UTC')
    expect(parsed.toISODate()).to.be.eq('2018-05-28')
  })
  it('ignores parseable date in the future', () => {
    const parsed = extractDate('2103-09-30 00:00:00.000000000 Z')
    expect(parsed).not.to.be.ok
  })
})

describe('test spawnPromisified ', () => {

  it('should handle spawn + command successfully', async () => {
    const { stdout: expected} = await execFile('ls', ['-l'])
    const actual = await spawnPromisified('ls', ['-l'])
    expect(actual).to.be.equal(expected)
  })

  it('should throw for spawn success + command failure', async () => {
    const expectedError = await getError(execFile('cat', ['t.txt']))
    const actualError = await getError(spawnPromisified('cat', ['t.txt']))
    expect(expectedError.code).to.be.equal(actualError.code)
    expect(expectedError.message).to.include(actualError.message)
  })

  it('should throw for spawn failure', async () => {
    const expectedError = await getError(execFile('f', ['t.txt']))
    const actualError = await getError(spawnPromisified('f', ['t.txt']))
    expect(expectedError.code).to.be.equal(actualError.code)
    expect(expectedError.message).to.be.equal(actualError.message)
  })

  it('should handle output more than 5MB', async () => {
    const largeFile = 'test/fixtures/debian/0ad_0.0.17-1_armhf.deb'
    const execFilePromise = execFile('cat', [largeFile, largeFile], {
      maxBuffer: 5 * 1024 * 1024
    })
    await expect(execFilePromise).to.be.rejectedWith('stdout maxBuffer length exceeded')

    const output = await spawnPromisified('cat', [largeFile, largeFile])
    expect(output).to.be.ok
  })
})

async function getError(promise) {
  try {
    await promise
  } catch (error) {
    return error
  }
}

