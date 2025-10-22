import LogoLoop from "../../Context/LogoLoop";
import { SiReact, SiExpress, SiTypescript,SiCss3,SiMysql, SiBootstrap, SiTailwindcss,SiHtml5, SiPython , SiDocker, SiGithub } from 'react-icons/si';


const techLogos = [
  { node: <SiReact />, title: "React", href: "https://react.dev" },
  { node: <SiExpress />, title: "Next.js", href: "https://nextjs.org" },
  { node: <SiTypescript />, title: "TypeScript", href: "https://www.typescriptlang.org" },
  { node: <SiTailwindcss />, title: "Tailwind CSS", href: "https://tailwindcss.com" },
  { node: <SiHtml5 />, title: "HTML5", href: "https://developer.mozilla.org/en-US/docs/Web/HTML" },
  { node: <SiCss3 />, title: "CSS3", href: "https://developer.mozilla.org/en-US/docs/Web/CSS" },
  { node: <SiMysql />, title: "MySQL", href: "https://www.mysql.com" },
  {node:<SiPython/>, title:"Python", href:"https://www.python.org" },
  {node:<SiDocker/>, title:"Docker", href:"https://www.docker.com" },
  {node:<SiGithub/>, title:"GitHub", href:"https://github.com" },
  { node: <SiBootstrap />, title: "Bootstrap", href: "https://getbootstrap.com" },
];

// Alternative with image sources
const imageLogos = [
  { src: "/logos/company1.png", alt: "Company 1", href: "https://company1.com" },
  { src: "/logos/company2.png", alt: "Company 2", href: "https://company2.com" },
  { src: "/logos/company3.png", alt: "Company 3", href: "https://company3.com" },
];


export default function Skills() {
  return (
    <div style={{ height: '200px', position: 'relative', overflow: 'hidden'}}>
        <h1 className="text-3xl ml-15 mt-5 font-bold mb-5">My Skills</h1>
      <LogoLoop
        logos={techLogos}
        speed={120}
        direction="left"
        logoHeight={48}
        gap={40}
        pauseOnHover
        scaleOnHover
        fadeOut
        fadeOutColor="#ffffff"
        ariaLabel="Technology partners"
      />
    </div>
  );
}


