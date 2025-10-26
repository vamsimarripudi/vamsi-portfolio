import { useState, useEffect } from "react";
import TextType from "../../Context/TextType";

const Home = () => {
  // 🎯 Show welcome banner for first-time visitors
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    const hasVisited = localStorage.getItem("hasVisited");
    if (!hasVisited) {
      setShowBanner(true);
      localStorage.setItem("hasVisited", "true");

      // Auto-hide after 5 seconds
      setTimeout(() => setShowBanner(false), 5000);
    }
  }, []);

  return (
    <>
      {/* 👋 Welcome Banner */}
      {showBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-gradient-to-r from-indigo-600 to-blue-500 text-white px-8 py-6 rounded-xl shadow-2xl text-center animate-fadeIn w-80 sm:w-96">
      <h2 className="text-2xl font-semibold mb-3">
        👋 Welcome to my portfolio!
      </h2>
      <p className="text-sm text-gray-100 mb-4">
        Welcome to my portfolio! Explore my projects and discover how I transform ideas into efficient, user-focused web experiences.
      </p>
      <button
        onClick={() => setShowBanner(false)}
        className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full text-sm transition"
      >
        Close
      </button>
    </div>
  </div>
      )}

      {/* 🏠 Home Section */}
      <section
        id="home"
        className="w-full min-h-screen bg-black text-white flex flex-col-reverse md:flex-row items-center justify-center px-6 sm:px-10 md:px-16 py-10 md:py-20 overflow-x-hidden"
      >
        {/* ✍️ Left Section - Text Content */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 mt-3 leading-tight">
            Hi, I’m <span className="text-blue-400">Vamsi Marripudi 👋</span>
          </h1>

          <h3 className="text-lg sm:text-xl mb-3 overflow-hidden">
            I'm a Passionate{" "}
            <TextType
              text={[
                "Full Stack Developer...",
                "Tech Explorer...",
                "Tech Enthusiast...",
                "Web Developer...",
                "Front-end Developer...",
                "Back-end Developer...",
                "Happy Coding!...",
              ]}
              typingSpeed={75}
              pauseDuration={1500}
              showCursor={true}
              cursorCharacter="|"
            />
          </h3>

          <p className="text-gray-300 text-sm sm:text-base mb-6">
            I love turning ideas into reality using clean code and modern
            frameworks, and I’m always eager to learn new technologies and
            improve my skills.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <a href="#projects">
              <button className="bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-black border border-blue-400 transition duration-300">
                View Projects
              </button>
            </a>
            <a href="/Vamsi CV.pdf" download>
              <button className="bg-green-500 text-white px-6 py-3 rounded-full hover:bg-black border border-green-400 transition duration-300">
                Download CV
              </button>
            </a>
          </div>
        </div>

        {/* 🖼️ Right Section - Profile Image */}
        <div className="flex justify-center md:justify-end mt-8 md:mt-0">
          <img
            src="/vamsi image.png"
            alt="Vamsi Marripudi"
            className="w-56 h-56 sm:w-72 sm:h-72 md:w-80 rounded-xl border border-blue-500 shadow-lg hover:scale-105 transition-transform duration-300"
          />
        </div>
      </section>
    </>
  );
};

export default Home;
