import {Link} from 'react-router-dom';
import {useState,useEffect} from "react";
import GradientText from "../../Context/GradientText"
import { HiOutlineBars3 } from 'react-icons/hi2';

const Header = () => {
    const [isOpen,setOpen] = useState(false);

   return (
    <nav className="bg-glass ml-2 md:ml-15  rounded-full   p-4 text-white mt-3 ml-8 mr-13 border-white-500  ">
        <div className="flex items-center justify-around hidden md:block md:flex">
           <div>
             <h1 className="font-serif text-3xl  font-bold">
            <GradientText
             colors={["#40ffaa", "#4079ff", "#40ffaa", "#4079ff", "#40ffaa"]}
             animationSpeed={3}
             showBorder={false}
             className="custom-class"
             >
             <span className="font-4xl">V</span>amsi <span className="font-4xl">M</span>arripudi
            </GradientText>
             </h1>  
            </div>
            <ul className="flex space-x-4 mt-2">
            <li><a href="/" className="hover:underline">Home</a></li>
            <li><a href="#projects" className="hover:underline">Projects</a></li>
            <li><a href="#skills" className="hover:underline">Skills</a></li>
            <li><a href="#about" className="hover:underline">About</a></li>
            <li><a href="#contact" className="hover:underline">Contact</a></li>
             </ul>
            <div>
            <a href="#contact">
            <button className="bg-yellow-500 text-white rounded-full px-4 py-2 cursor-pointer hover:bg-black border-1">Contact Me</button>
            </a>
            </div>
       </div>
        {/* Mobile-Menu */}
       <div className="mt-2 pl-10 pr-10 text-center border-1 flex items-center justify-between border-white-100 rounded-full w-100 md:hidden sm:block ">
          <img src="/Favcon.jpg" alt="logo" className="h-15 w-20"/>
          <button onClick={() => setOpen(!isOpen)}>
            {isOpen ? "X": <HiOutlineBars3 className="h-8 w-8 text-white cursor-pointer "/>}
          </button>
          
          {isOpen && (
            <div className="absolute top-20 left-4 right-4 z-10 rounded-lg shadow-lg m-10 bg-neutral-900  ">
            <ul  className="flex flex-col items-center  justify-center md:hidden bg-neutral-900 text-center space-y-4 py-6 ">
              <li><a href="#home" className="block hover:text-cyan-400 mr-3" onClick={() => setIsOpen(false)}>Home</a></li>
              <li><a href="#projects" className="block hover:text-cyan-400 mr-3" onClick={() => setIsOpen(false)}>Projects</a></li>
              <li><a href="#about" className="block hover:text-cyan-400 mr-3" onClick={() => setIsOpen(false)}>About</a></li>
              <li><a href="#contact" className="block hover:text-cyan-400 mr-3" onClick={() => setIsOpen(false)}>Contact</a></li>
              <li><a href="https://www.backendportfolio.xyz" className="block hover:text-cyan-400 mr-3" onClick={() => setIsOpen(false)}>Resourses</a></li>
            </ul>
            </div>
            
          )}
         
       </div>

    </nav>
   )
}

export default Header