import React from "react";

const About = () => (
  <div className="min-h-100 px-4 md:px-10 mt-7 mb-7 text-white">
    <h1 className="text-3xl font-bold mb-6  ml-5 md:text-left">About Me</h1>

    <div className="flex flex-col md:flex-row items-center md:items-start mt-5 space-y-8 md:space-y-0 md:space-x-10">
      {/* Left Section (Text) */}
      <div className="md:w-2/2.5 flex flex-col p-5 ">
        <p className="text-xl text-gray-300 leading-relaxed max-w-[800px]">
          I'm <span className="text-cyan-400 font-semibold">Vamsi Marripudi</span>, a passionate Full Stack Developer
          with expertise in building dynamic and responsive web applications.
          With a strong foundation in both front-end and back-end technologies, I
          thrive on turning ideas into reality through clean code and modern
          frameworks. My journey in tech is driven by curiosity and a commitment
          to continuous learning, allowing me to stay updated with the latest
          industry trends. When I'm not coding, I enjoy exploring new
          technologies, contributing to open-source projects, and collaborating
          with fellow developers to create impactful solutions.
        </p>
      </div>

      {/* Right Section (Image) */}
      <div className="flex justify-center md:justify-end">
        <img
          src="/vamsi image.png"
          alt="Vamsi Marripudi"
          className="w-56 h-60 sm:w-72 sm:h-72 md:w-75 rounded-xl border border-blue-500 shadow-lg hover:scale-105 transition-transform duration-300"
        />
      </div>
    </div>
  </div>
);

export default About;
