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
import Services from '../components/Services'
import SEO from '../components/SEO'
import FAQ from '../components/FAQ'

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50 text-zinc-900">
      <SEO
        title="Personal Trainer in Dublin | Training for Life with Michael Byrne"
        description="1:1 personal training and online coaching in South Dublin with Michael Byrne. Strength training, weight loss and capability coaching for adults. Book a free consultation today."
        canonical="https://trainingforlife.ie"
      />
      <Navbar />
      <Hero />
      <Problem />
      <Philosophy />
      <Outcomes />
      <Services />
      <Process />
      <Testimonials />
      <About />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
