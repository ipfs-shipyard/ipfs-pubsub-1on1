'use strict'

const IPFS = require('ipfs')
const rmrf = require('rimraf')
const config = require('./config')
const pMapSeries = require('p-map-series')

/**
 * Start an IPFS instance
 * @param  {Object}  config  [IPFS configuration to use]
 * @return {[Promise<IPFS>]} [IPFS instance]
 */
const startIpfs = (config = {}) => {
  return new Promise((resolve, reject) => {
    const ipfs = new IPFS(config)
    ipfs.on('error', reject)
    ipfs.on('ready', () => resolve(ipfs))
  })
}

const createIpfsTestInstances = async (ipfsPaths) => {
  // Create all instance sequentially
  return await pMapSeries(ipfsPaths, async (ipfsPath) => {
    rmrf.sync(ipfsPath) // remove test data
    const ipfsConfig = Object.assign({}, config.defaultIpfsConfig, { repo: ipfsPath })
    return await startIpfs(ipfsConfig) // Returns a Promise<IPFS>
  })
}

const connectIpfsInstances = async (instances) => {
  // Multiaddress of all instances
  const addresses = instances.map(ipfs => ipfs._peerInfo.multiaddrs._multiaddrs[0].toString())
  // Connect each instance with all other instances
  instances.forEach(ipfs => {
    // Connect to all addresses
    addresses.forEach(addr => {
      // But don't try to connect to self
      if (addr !== ipfs._peerInfo.multiaddrs._multiaddrs[0].toString()) {
        ipfs.swarm.connect(addr)
      }
    })
  })
}

exports.startIpfs = startIpfs
exports.createIpfsTestInstances = createIpfsTestInstances
exports.connectIpfsInstances = connectIpfsInstances
