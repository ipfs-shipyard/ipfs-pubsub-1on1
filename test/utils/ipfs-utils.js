'use strict'

const IPFS = require('ipfs')
const rmrf = require('rimraf')
const pMapSeries = require('p-map-series')
const config = require('./config')
const waitForPeers = require('../../src/wait-for-peers')

/**
 * Start an IPFS instance
 * @param  {Object}  config  [IPFS configuration to use]
 * @return {[Promise<IPFS>]} [IPFS instance]
 */
const startIpfs = async (config = {}) => {
  const ipfs = await IPFS.create(config)
  return ipfs
}

const createIpfsTestInstances = async (ipfsPaths) => {
  // Create all instance sequentially
  return await pMapSeries(ipfsPaths, async (ipfsPath) => {
    rmrf.sync(ipfsPath) // remove test data
    const ipfsConfig = Object.assign({}, config.defaultIpfsConfig, { repo: ipfsPath })
    return await startIpfs(ipfsConfig) // Returns a Promise<IPFS>
  })
}

const destroyIpfsTestInstances = async (instances, ipfsPaths) => {
  const stop = ipfs => ipfs.stop()
  const removeDir = p => rmrf.sync(p)
  await pMapSeries(instances, stop)
  ipfsPaths.forEach(removeDir)
}

const connectIpfsInstances = async (instances) => {
  // Multiaddress of all instances
  const addresses = await Promise.all(instances.map(async ipfs => (await instances[0].id()).addresses[0]))
  // Connect each instance with all other instances
  for (const instance of instances) {
    const thisAddress = (await instance.id()).addresses[0]
    // Connect to all addresses
    for (const addr of addresses) {
      // But don't try to connect to self
      if(addr !== thisAddress) {
        instance.swarm.connect(addr)
      }
    }
  }
}

exports.startIpfs = startIpfs
exports.createIpfsTestInstances = createIpfsTestInstances
exports.destroyIpfsTestInstances = destroyIpfsTestInstances
exports.connectIpfsInstances = connectIpfsInstances
exports.waitForPeers = waitForPeers
