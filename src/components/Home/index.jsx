import TextType from "../../Context/TextType";

const Home = () => (
  <div className="min-h-130 min-w-90 ml-5 mr-2  md:ml-15 mr-15 w-auto mt-5 flex flex-col-reverse md:flex-row items-center justify-center px-6 md:px-20 bg-black text-white py-10 md:py-20 border-1 rounded-2xl space-y-5 md:space-y-0">
    {/* Left Section */}
      <div className="flex flex-col items-center md:items-start text-center md:text-left max-w-1xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-3 mt-3 leading-tight">
        Hi, I’m <span className="text-blue-400">Vamsi Marripudi 👋</span>
        </h1>

        <h3 className="w-full w-30 h-15 text-lg sm:text-md md:h-5  mb-2 overflow-hidden">
        I'm a Passionate{" "}
        <TextType
          text={[
          "Full Stack Developer...",
          "Tech Explorer...",
          "Tech Enthusiast...",
          "Web Development...",
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
        I love turning ideas into reality using clean code and modern frameworks, and I am always eager to learn new technologies and improve my skills.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
        <a href="#projects">
          <button className="bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-black border-1 cursor-pointer transition duration-300 ">
          View Projects
          </button>
        </a>
        <a href="/Vamsi CV.pdf" download>
          <button className="bg-green-500 text-white px-6 py-3 rounded-full hover:bg-black border-1 cursor-pointer transition duration-300 ">
          Download CV
          </button>
        </a>
        </div>
      </div>

      {/* Right Section */}
    <div className="flex justify-center md:justify-end">
      <img
        src="/vamsi image.png"
        alt="Vamsi Marripudi"
        className="w-56 h-70 sm:w-72 sm:h-72 sm:mb-5 md:w-80 lg:w-70 lg:ml-10 rounded-xl border-1 border-blue-500 shadow-lg hover:scale-105 transition-transform duration-300"
      />
    </div>
  </div>
);

export default Home;
