export default async (ipfs) => {
  const peerInfo = await ipfs.id()
  return peerInfo.id
}
