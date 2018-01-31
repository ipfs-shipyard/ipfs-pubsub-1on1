'use strict'

const waitForPeers = (ipfs, peersToWait, topic) => {
  return new Promise(async (resolve, reject) => {
    let peers = await ipfs.pubsub.peers(topic)
    let hasAllPeers = peersToWait.map((e) => peers.includes(e)).filter((e) => e === false).length === 0

    if (hasAllPeers) {
      return resolve()
    }

    const i = setInterval(async () => {
      peers = await ipfs.pubsub.peers(topic)
      hasAllPeers = peersToWait.map((e) => peers.includes(e)).filter((e) => e === false).length === 0
      if (hasAllPeers) {
        clearInterval(i)
        resolve()
      }
    }, 10)
  })
}

module.exports = waitForPeers
