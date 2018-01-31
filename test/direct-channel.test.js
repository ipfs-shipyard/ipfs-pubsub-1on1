'use strict'

const path = require('path')
const assert = require('assert')
const rmrf = require('rimraf')
const config = require('./utils/config')
const startIpfs = require('./utils/start-ipfs')
const waitForPeers = require('./utils/wait-for-peers')

const Channel = require('../src/direct-channel.js')
const PROTOCOL = require('../src/protocol')

const ipfsPath1 = './test-data/peer1/ipfs'
const ipfsPath2 = './test-data/peer2/ipfs'
const ipfsPath3 = './test-data/peer3/ipfs'

describe('DirectChannel', function() {
  this.timeout(config.timeout)

  let ipfs1, ipfs2, ipfs3

  before(async () => {
    rmrf.sync(ipfsPath1)
    rmrf.sync(ipfsPath2)
    rmrf.sync(ipfsPath3)
    config.daemon1.repo = ipfsPath1
    config.daemon2.repo = ipfsPath2
    config.daemon3.repo = ipfsPath3
    ipfs1 = await startIpfs(config.daemon1)
    ipfs2 = await startIpfs(config.daemon2)
    ipfs3 = await startIpfs(config.daemon3)
    // Connect the peers manually to speed up test times
    await ipfs2.swarm.connect(ipfs1._peerInfo.multiaddrs._multiaddrs[0].toString())
    await ipfs1.swarm.connect(ipfs2._peerInfo.multiaddrs._multiaddrs[0].toString())
    await ipfs3.swarm.connect(ipfs1._peerInfo.multiaddrs._multiaddrs[0].toString())
  })

  after(async () => {
    if (ipfs1)
      await ipfs1.stop()

    if (ipfs2)
      await ipfs2.stop()

    if (ipfs3)
      await ipfs3.stop()
  })

  describe('create a channel', function() {
    it('has two participants', async () => {
      const c = new Channel(ipfs1, ipfs2._peerInfo.id._idB58String)

      const expectedPeerIDs = Array.from([
        ipfs1._peerInfo.id._idB58String, 
        ipfs2._peerInfo.id._idB58String
      ]).sort()

      assert.deepEqual(c.peers, expectedPeerIDs)

      c.close()
    })

    it('has correct ID', async () => {
      const c = new Channel(ipfs1, ipfs2._peerInfo.id._idB58String)

      const expectedID = Array.from([
        ipfs1._peerInfo.id._idB58String, 
        ipfs2._peerInfo.id._idB58String
      ]).sort().join('/')

      assert.deepEqual(c.id, path.join('/', PROTOCOL, expectedID))

      c.close()
    })

    it('connects two peers', async () => {
      const c1 = new Channel(ipfs1, ipfs2._peerInfo.id._idB58String)
      const c2 = new Channel(ipfs2, ipfs1._peerInfo.id._idB58String)

      const expectedPeerIDs = Array.from([
        ipfs1._peerInfo.id._idB58String, 
        ipfs2._peerInfo.id._idB58String
      ]).sort()

      assert.deepEqual(c1.peers, expectedPeerIDs)
      assert.deepEqual(c2.peers, expectedPeerIDs)
      assert.deepEqual(c1.id, path.join('/', PROTOCOL, expectedPeerIDs.join('/')))
      assert.deepEqual(c2.id, path.join('/', PROTOCOL, expectedPeerIDs.join('/')))

      c1.close()
      c2.close()
    })

    it('emits \'ready\' event', (done) => {
      const c1 = new Channel(ipfs1, ipfs2._peerInfo.id._idB58String)
      const c2 = new Channel(ipfs2, ipfs1._peerInfo.id._idB58String)

      c2.on('ready', (id) => {
        assert.equal(id, c1.id)
        assert.equal(id, c2.id)
        c1.close()
        c2.close()
        done()
      })
    })
  })

  describe('messaging', function() {
    it('sends and receives messages', async () => {
      const c1 = new Channel(ipfs1, ipfs2._peerInfo.id._idB58String)
      const c2 = new Channel(ipfs2, ipfs1._peerInfo.id._idB58String)

      await waitForPeers(ipfs2, [ipfs1._peerInfo.id._idB58String], c2.id)
      await waitForPeers(ipfs1, [ipfs2._peerInfo.id._idB58String], c1.id)

      return new Promise((resolve, reject) => {
        c1.on('error', reject)
        c2.on('error', reject)

        c2.on('message', (m) => {
          assert.equal(m.from, ipfs1._peerInfo.id._idB58String)
          assert.equal(m.data.toString(), 'hello1')
          assert.equal(m.topicIDs.length, 1)
          assert.equal(m.topicIDs[0], c1.id)
          assert.equal(m.topicIDs[0], c2.id)
          c2.send(Buffer.from('hello2'))
        })

        c1.on('message', (m) => {
          assert.equal(m.from, ipfs2._peerInfo.id._idB58String)
          assert.equal(m.data.toString(), Buffer.from('hello2'))
          assert.equal(m.topicIDs.length, 1)
          assert.equal(m.topicIDs[0], c1.id)
          assert.equal(m.topicIDs[0], c2.id)
          c1.close()
          c2.close()
          resolve()
        })

        c1.send('hello1')
      })
    })
  })

  describe('disconnecting', function() {
    it('closes a channel', async () => {
      const c1 = new Channel(ipfs1, ipfs2._peerInfo.id._idB58String)
      const c2 = new Channel(ipfs2, ipfs1._peerInfo.id._idB58String)

      await waitForPeers(ipfs2, [ipfs1._peerInfo.id._idB58String], c2.id)
      await waitForPeers(ipfs1, [ipfs2._peerInfo.id._idB58String], c1.id)

      return new Promise(async (resolve, reject) => {
        c1.close()
        const topics1 = await ipfs1.pubsub.ls()
        assert.deepEqual(topics1, [])

        c2.close()
        const topics2 = await ipfs2.pubsub.ls()
        assert.deepEqual(topics1, [])

        setTimeout(async () => {
          const peers1 = await ipfs1.pubsub.peers(c1.id)
          const peers2 = await ipfs2.pubsub.peers(c1.id)
          assert.deepEqual(peers1, [])
          assert.deepEqual(peers2, [])
          resolve()
        }, 200)
      })
    })
  })

  describe('errors', function() {
    it('throws an error if pubsub is not supported by given IPFS instance', async () => {
      let c, err
      try {
        c = new Channel({}, ipfs2._peerInfo.id._idB58String)
      } catch (e) {
        err = e
      }
      
      assert.equal(err, 'Error: This IPFS node does not support pubsub.')
    })
  })

  describe('non-participant peers can\'t send messages', function() {
    it('doesn\'t receive unwated messages', async () => {
      const c1 = new Channel(ipfs1, ipfs2._peerInfo.id._idB58String)
      const c2 = new Channel(ipfs2, ipfs1._peerInfo.id._idB58String)

      await waitForPeers(ipfs2, [ipfs1._peerInfo.id._idB58String], c2.id)
      await waitForPeers(ipfs1, [ipfs2._peerInfo.id._idB58String], c1.id)

      return new Promise(async (resolve, reject) => {
        c1.on('error', reject)
        c1.on('message', (m) => {
          assert.equal(m.from, ipfs2._peerInfo.id._idB58String)
          assert.equal(m.data.toString(), 'hello1')
          assert.equal(m.topicIDs.length, 1)
          assert.equal(m.topicIDs[0], c1.id)
          assert.equal(m.topicIDs[0], c2.id)
          c1.close()
          c2.close()
          resolve()
        })

        await ipfs3.pubsub.subscribe(c1.id, () => {})
        await waitForPeers(ipfs1, [ipfs3._peerInfo.id._idB58String], c1.id)
        await ipfs3.pubsub.publish(c1.id, Buffer.from('OMG!'))

        c2.send('hello1')
      })
    })
  })
})
