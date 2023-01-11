export default async (ipfs, peersToWait, topic, isClosed) => {
  const checkPeers = async () => {
    const peers = await ipfs.pubsub.peers(topic)
    const idPeersToWait = peersToWait.map(e => String(e))
    const idPeers = peers.map(e => String(e))
    const hasAllPeers = idPeersToWait.map((e) => idPeers.includes(e)).filter((e) => e === false).length === 0
    return hasAllPeers
  }

  if (await checkPeers()) {
    return Promise.resolve()
  }

  return new Promise(async (resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        if (isClosed()) {
          clearInterval(interval)
        } else if (await checkPeers()) {
          clearInterval(interval)
          resolve()
        }
      } catch (e) {
        reject(e)
      }
    }, 100)
  })
}
