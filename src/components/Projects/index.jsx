import { CarouselDefault } from "../../Context/ProjectCard/projectcard.jsx";

const projectsList = [
  {
    title: "Jobby App",
    description: "Jobby — Your career starts with one tap!",
    link: "https://jobbybyvamsi.ccbp.tech",
    imageUrl: "/jobby-image-1.png",
  },
  {
    title: "BMI Calculator",
    description: "Calculate your Body Mass Index with ease!",
    link: "https://vamsibmiapp.ccbp.tech",
    imageUrl: "/bmi-image-1.png",
  },
  {
    title: "NxtTrenz E-commerce",
    description: "Your one-stop shop for the latest trends!",
    link: "https://nxttrendsvamsi.ccbp.tech",
    imageUrl: "/nxttrend-image-1.png",
  },
];

const Projects = () => (
  <section
    id="projects"
    className="w-full min-h-screen bg-black text-white px-4 sm:px-8 md:px-16 py-10 overflow-x-hidden"
  >
    <h1 className="text-3xl font-bold mb-8 text-center md:text-left">
      My Projects
    </h1>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 place-items-center">
      {projectsList.map((project, index) => (
        <div
          key={index}
          className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:scale-105 transition-transform duration-300 flex flex-col w-full sm:w-80"
        >
          {/* Image */}
          <img
            src={project.imageUrl}
            alt={project.title}
            className="w-full h-56 sm:h-64 object-cover"
          />

          {/* Content */}
          <div className="p-4 flex flex-col flex-grow">
            <h2 className="text-xl font-semibold mb-2 text-white">
              {project.title}
            </h2>
            <p className="text-gray-300 text-md mb-3">{project.description}</p>

            <ul className="flex flex-wrap gap-2 mb-4">
              <li className="bg-black text-white px-3 py-1 text-sm rounded-full">
                HTML
              </li>
              <li className="bg-black text-white px-3 py-1 text-sm rounded-full">
                CSS
              </li>
              <li className="bg-black text-white px-3 py-1 text-sm rounded-full">
                JavaScript
              </li>
              <li className="bg-black text-white px-3 py-1 text-sm rounded-full">
                ReactJS
              </li>
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
  </section>
);

export default Projects;
 b  