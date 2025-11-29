import { CarouselDefault } from "../../Context/ProjectCard/projectcard.jsx";
import "./index.css"

const projectsList = [
  {
    title: "Jobby App",
    description: "Your career starts with one tap!",
    link: "https://jobbybyvamsi.ccbp.tech",
    imageUrl: "/jobby-image-1.png",
    technologies: ["HTML", "CSS", "JavaScript", "ReactJS"],
  },
  {
    title: "Twitter Clone DB",
    description: "API performs operations on Twitter Clone.",
    link: "https://github.com/vamsimarripudi/twitter-API-s.git",
    imageUrl:
      "https://res.cloudinary.com/dpd6wdnou/image/upload/v1761218488/ChatGPT_Image_Oct_23_2025_04_48_26_PM_nf8jcy.png",
    technologies: ["NodeJS", "ExpressJS", "REST API", "CRUD"],
  },
  {
    title: "NxtTrenz E-commerce",
    description: "Your one-stop shop for the latest trends!",
    link: "https://nxttrendsvamsi.ccbp.tech",
    imageUrl: "/nxttrend-image-1.png",
    technologies: ["HTML", "CSS", "JavaScript", "ReactJS"],
  },
];

function credentialsAlert() {
  alert("Username: rahul, Password: rahul@2021");
}

const Projects = () => (
  <section
    id="projects"
    className="w-full min-h-screen  px-4 sm:px-8 md:px-16 py-10 overflow-x-hidden"
  >
    <div className="flex items-center justify-between flex-wrap mb-10">
      <h1 className="text-3xl font-bold mb-4 text-center md:text-left">
        My Projects
      </h1>
      <p
        title="Click to view the credentials"
        onClick={credentialsAlert}
        className="cursor-pointer text-gray-400 text-sm mb-4 text-center md:text-left hover:text-gray-200"
      >
        Credentials
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 place-items-center">
      {projectsList.map((project, index) => (
        <div
          key={index}
          className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:scale-105 transition-transform duration-300 flex flex-col w-full sm:w-80 h-full"
        >
          {/* Image Section */}
          <div className="w-full overflow-hidden " >
            <img
              src={project.imageUrl}
              alt={project.title}
              className="image-div"
            />
          </div>

          {/* Content Section */}
          <div className="p-4 flex flex-col flex-grow">
            <h2 className="text-xl font-semibold mb-2 text-white">
              {project.title}
            </h2>

            <p className="text-gray-300 text-md mb-3 flex-grow">
              {project.description}
            </p>

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
