import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Philosophy from '../components/Philosophy'
import Problem from '../components/Problem'
import Outcomes from '../components/Outcomes'
import Process from '../components/Process'
import Testimonials from '../components/Testimonials'
import About from '../components/About'
import FinalCTA from '../components/FinalCTA'
import Footer from '../components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50 text-zinc-900">
      <Navbar />
      <Hero />
      <Problem />
      <Philosophy />
      <Outcomes />
      <Process />
      <Testimonials />
      <About />
      <FinalCTA />
      <Footer />
    </div>
  )
}