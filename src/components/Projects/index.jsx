import { CarouselDefault } from "../../Context/ProjectCard/projectcard.jsx";

const projectsList = [
  {
    title: "Jobby App",
    description: "Your career starts with one tap!",
    link: "https://jobbybyvamsi.ccbp.tech",
    imageUrl: "/jobby-image-1.png",
    technologies:["HTML","CSS","JavaScript","ReactJS"]
  },
  {
    title: "Twitter Clone DB",
    description: "API perform Operations to Twitter Clone.",
    link: "https://github.com/vamsimarripudi/twitter-API-s.git",
    imageUrl: "https://res.cloudinary.com/dpd6wdnou/image/upload/v1761218488/ChatGPT_Image_Oct_23_2025_04_48_26_PM_nf8jcy.png",
    technologies:["NodeJS","ExpressJS","REST API","CURD"]
  },
  {
    title: "NxtTrenz E-commerce",
    description: "Your one-stop shop for the latest trends!",
    link: "https://nxttrendsvamsi.ccbp.tech",
    imageUrl: "/nxttrend-image-1.png",
    technologies:["HTML","CSS","JavaScript","ReactJS"]
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
            className="w-auto h-56 sm:h-64 object-cover"
          />

          {/* Content */}
          <div className="p-4 flex flex-col flex-grow">
            <h2 className="text-xl font-semibold mb-2 text-white">
              {project.title}
            </h2>
            <p className="text-gray-300 text-md mb-3">{project.description}</p>

            <ul className="flex flex-wrap gap-2 mb-4">
              {project.technologies.map((tech, techIndex) => (
                <li
                  key={techIndex}
                  className="bg-black text-white px-3 py-1 text-sm rounded-full"
                >
                  {tech}
                </li>
              ))}
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