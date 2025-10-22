import {CarouselDefault} from "../../Context/ProjectCard/projectcard.jsx"

const projectsList = [
    {
        title: "Jobby App",
        description: "Jobby — Your career starts with one tap!",
        link: "https://jobbybyvamsi.ccbp.tech",
        imageUrl: "/jobby-image-1.png"
    },
    {       title: "BMI Calculator",
        description: "Calculate your Body Mass Index with ease!",
        link: "vamsibmiapp.ccbp.tech",
        imageUrl: "/bmi-image-1.png"
    },
    {
        title: "NxtTrenz E-commerce",
        description: "Your one-stop shop for the latest trends!",
        link: "https://nxttrendsvamsi.ccbp.tech",
        imageUrl: "/nxttrend-image-1.png"
    }               

];


const Projects = () => (
    <div className="min-h-82 mt-5 mb-10 m-10  text-white">
        <h1 className="text-3xl ml-5 mt-5 font-bold">My Projects</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 px-4 md:px-8">
  {projectsList.map((project, index) => (
    <div
      key={index}
      className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:scale-105  transition-transform duration-300 flex flex-col"
    >
      {/* Image */}
      <img
        src={project.imageUrl}
        alt={project.title}
        className="w-full h-56 sm:h-64 object-cover"
      />

      {/* Content */}
      <div className="p-4 flex flex-col flex-grow">
        <h2 className="text-xl font-semibold mb-2 text-white">{project.title}</h2>
        <p className="text-gray-300 text-md mb-3">{project.description}</p>

        <ul className="flex flex-wrap gap-2 mb-4">
          <li className="bg-black text-white px-3 py-1 text-sm rounded-full">HTML</li>
          <li className="bg-black text-white px-3 py-1 text-sm rounded-full">CSS</li>
          <li className="bg-black text-white px-3 py-1 text-sm rounded-full">JavaScript</li>
          <li className="bg-black text-white px-3 py-1 text-sm rounded-full">ReactJS</li>
        </ul>

        <a
          href={project.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline mt-auto"
        >
          View Project
        </a>
      </div>
    </div>
  ))}
</div>

    </div>
)

export default Projects