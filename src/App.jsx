import {useState,useEffect} from "react";
import Header from "./components/Header"; 
import Home from "./components/Home";
import About from "./components/About";
import Projects from "./components/Projects";
import Skills from "./components/Skills";
import Contact from "./components/Contact";
import { FaArrowUp } from 'react-icons/fa';

import "./App.css";


const App = () => (
  
        
  <div className="app-container  min-h-screen min-w-screen  scroll-smooth mr-5  ">
    <Header />
    <section id="home"><Home/></section>
    <section id="projects"><Projects/></section>
    <section id="skills"><Skills/></section>
    <section id="about"><About/></section>
    <section id="contact"><Contact/></section>
    <footer className="min-h-72 text-center p-4 text-gray-400 border-t bg-gray border-gray-700 mt-10">
      <div className=" flex flex-wrap grid grid-cols-1 md:grid-cols-4  mb-4">
        <div className="text-center flex flex-col items-center md:items-start m-3">
        
          <h1 className="text-blue-400 text-3xl m-2 mb-3 font-serif font-bold">Vamsi Marripudi</h1>
          <p className="text-gray-300 m-2">Full Stack Developer</p>
          <p className="text-gray-100 m-2">enquiry.portfolio@vamsimarripudi.tech</p>
          <p className="text-gray-300 ml-2 text-lg">Mobile No: +91-7013981759</p>
        </div>
        <div>
          <h3 className="underline text-lg mb-1 text-white">Quick Links</h3>
          <ul className="space-y-2">
              <li><a href="#home" className="hover:text-blue-400">Home</a></li>
              <li><a href="#about" className="hover:text-blue-400">About</a></li>
              <li><a href="#skills" className="hover:text-blue-400">Skills</a></li>
              <li><a href="#projects" className="hover:text-blue-400">Projects</a></li>
              <li><a href="#contact" className="hover:text-blue-400">Contact</a></li>
          </ul> 

        </div>
        <div>
          <h3 className="underline text-lg mb-1 text-white">Technologies</h3>
          <ul className="flex flex-col justify-center list-none">
          <a href ="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank"><li className="m-1 hover:text-blue-500">JavaScript</li></a>
          <a href="https://react.dev/" target="_blank"><li className="m-1 hover:text-blue-500">ReactJS</li></a>
          <a href="https://nodejs.org/en" target="_blank"><li className="m-1 hover:text-blue-500">NodeJS</li></a>
          <a href="https://expressjs.com/" target="_blank"><li className="m-1 hover:text-blue-500">ExpressJS</li></a>
          <a href="https://web.dev/html" target="_blank"><li className="m-1 hover:text-blue-500">HTML</li></a>
          <a href="https://www.w3.org/Style/CSS/" target="_blank"><li className="m-1 hover:text-blue-500">CSS</li></a>
          <a href="https://www.mongodb.com/" target="_blank"><li className="m-1 hover:text-blue-500">MongoDB</li></a>
          </ul>
        </div>
        <div>
          <h3 className="underline text-white text-lg mb-1 ">Address</h3>
          <p>1-95, Ramanayyapeta,</p>
          <p>Kirlampudi,</p>
          <p>Kirlampudi Mandal,</p>
          <p>East Godavari,</p>
          <p>Andhrapradesh, IN-533431.</p>
        </div>
      </div>
      <hr className="border-1 text-white-50"/>
     <div className="mt-2 flex items-center md:items-flex-end justify-end space-y-2 md:space-y-0 md:space-x-4">
      &copy; {new Date().getFullYear()} Vamsi Marripudi. All rights reserved.
         </div>

       </footer> 
        <div className="fixed bottom-8 right-8 border-1 p-3 rounded-full cursor-pointer " onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} >
       <FaArrowUp size={28}/>
         </div>
          </div>
      )

export default App