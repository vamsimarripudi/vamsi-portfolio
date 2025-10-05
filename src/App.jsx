import { BrowserRouter , Route, Routes } from "react-router-dom";
import Home from "./components/Home";
import About from "./components/About";
import Contact from "./components/Contact";



/*const App = () => (
  <BrowserRouter>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/about" element={<About />} />
    <Route path="/contact" element={<Contact />} />
  </Routes>
  </BrowserRouter>
)*/
const App = () => (
<div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '100vh', textAlign: 'center' }}>
  <img style={{height:"400px"}} src="https://media.istockphoto.com/id/1495430612/vector/coming-soon-with-colorful-cut-out-foil-ribbon-confetti-background.jpg?s=612x612&w=0&k=20&c=0HjZUHqlNnUedZmJCbMpooiY92f4tgGCh_jZK51zSmU=" alt="Vamsi Krishna" />
<p>Stay tuned for more updates!</p>
  
</div>
  )


export default App