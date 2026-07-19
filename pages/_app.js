import '../styles/globals.css'
import HubPwaRegister from '../components/HubPwaRegister'

export default function App({ Component, pageProps }) {
  return (
    <>
      <HubPwaRegister />
      <Component {...pageProps} />
    </>
  )
}
