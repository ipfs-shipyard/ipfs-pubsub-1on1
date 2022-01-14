'use strict'

let interval = null

const waitForPeers = async (ipfs, peersToWait, topic) => {
  const checkPeers = async () => {
    const peers = await ipfs.pubsub.peers(topic)
    const hasAllPeers = peersToWait.map((e) => peers.includes(e)).filter((e) => e === false).length === 0
    return hasAllPeers
  }

  if (await checkPeers()) {
    return Promise.resolve()
  }

  return new Promise(async (resolve, reject) => {
    interval = setInterval(async () => {
      try {
        if (await checkPeers()) {
          clearInterval(interval)
          interval = null
          resolve()
        }
      } catch (e) {
        reject(e)
      }
    }, 100)
  })
}

const clearWaitForPeersInterval = () => {
  if (interval) {
    clearInterval(interval)
  }
}

module.exports = { waitForPeers, clearWaitForPeersInterval }
