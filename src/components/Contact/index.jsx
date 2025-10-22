import {useState,useEffect} from "react";
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { FaLinkedin } from 'react-icons/fa';
import { FaGithub } from 'react-icons/fa';
import { BsTwitterX } from 'react-icons/bs';

gsap.registerPlugin(ScrollTrigger)

const Contact = () => {

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        siteType:"",
        budget:"",
        description:""
    });
    const [error, setError] = useState('')
	const [success, setSuccess] = useState('')
	const [latest, setLatest] = useState(null)
	const [showPopup, setShowPopup] = useState(false)
	const MAX_WORDS = 300

    function handleChange(e) {
		const { name, value } = e.target;
		setFormData(() => ({ ...formData, [name]: value }));
		setError('');
	}

    useEffect(() => {
		const ctx = gsap.context(() => {
			gsap.from('.contact .left h2', { x: -12, opacity: 0, duration: 0.7, ease: 'power3.out' })
			gsap.from('.contact .right', { x: 12, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.08 })
			gsap.from('.contact form', { y: 8, opacity: 0, duration: 0.7, ease: 'power3.out', delay: 0.12 })
		}, root)
		return () => ctx.revert()
	}, [])

	function countChars(text) {
		return text.length;
	}

    function handleDescriptionChange(e) {
		const raw = e.target.value;
		if (raw.length > MAX_WORDS) {
			setFormData(f => ({ ...f, description: raw.slice(0, MAX_WORDS) }));
		} else {
			setFormData(f => ({ ...f, description: raw }));
		}
		setError('');
	}

    function validEmail(email) {
		return /^\S+@\S+\.\S+$/.test(email);
	}

    async function handleSubmit(e){
        e.preventDefault();
        setError("")
        setSuccess("")

        const {name,budget,description,email,siteType} = formData 
        if(!name.trim()) return setError("Please Enter Your Name")
        if(!validEmail(email)) return setError("Please enter a valid email")
        if(countChars(description) === 0) return setError("Please add a short project description (Max: 300 Characters")
        
        try{
            console.log("Sending Request to Backend")
            const apiUrl = "https://www.backendportfolio.xyz/api/contact"
            const options = {
                method:"POST",
                headers:{
                    "Content-Type":"application/json",
                    "Accept":"application/json"
                },
                mode:"cors",
                body:JSON.stringify({name,email,budget,siteType,description})
            }
            const res= await fetch(apiUrl,options)
            console.log("Request Received: ",res.status,res.statusText)

            if(!res.ok){
                const errorData = await res.text()
                console.error("Error:" ,errorData)
                throw new Error(`Server Error: ${res.status} - ${errorData}`)
            }

            const data = await res.json()
            console.log('Success data:', data)
			setSuccess('Thanks — your message was received!')
			setFormData({ name: '', email: '', siteType: '', budget: '', description: '' })
			setShowPopup(true)
			setTimeout(() => setShowPopup(false), 3000)
			setLatest(null)


        }catch(err){
            console.error('Fetch error:', err)
			setError(`Failed to send message: ${err.message}`)
			setLatest(null)

        }

        

    }

    const remaining = MAX_WORDS - countChars(formData.description)

    return (
        <>
            {showPopup && (
            <div>
             className="fixed top-6 right-6 z-[9999] bg-gradient-to-r from-[#e8f7ff] to-[#f0fff0] 
               rounded-xl border border-[#b2e2e2] shadow-md 
               px-8 py-4 text-[#0078d4] font-bold text-lg"
             Request successful
             </div>
            )}
            <div className="min-h-130 px-4 md:px-3 mt-7  ">
             <h1 className="text-3xl  font-bold ml-15 sm: text-2xl ml-10 text-white mt-10">Contact Me</h1>
             <div className=" border-1 rounded-3xl p-5 ml-13 mr-13 flex flex-col md:flex-row items-center md:items-start mt-5 space-y-8 md:space-y-0 md:space-x-10">
            <div className="ml-7 flex flex-col md:flex-row w-full md:w-auto" ref={root}>
                
                <div className="left  md:ml-15  md:mb-0 max-w-auto">
                <h2 className="text-xl font-semibold mb-2 mt-10 text-white">Get in Touch</h2>
                <p className="text-gray-300 text-md mb-3 max-w-md">
                    I'm excited to hear about your project! Whether you have a clear vision or just an idea, feel free to reach out. Let's collaborate to bring your web development needs to life. Fill out the form below, and I'll get back to you as soon as possible.
                </p>
                <div>
                    <h3 className="mb-5 text-white-800 text-md underline">Social Media:-</h3>
                    <div className="flex items-center mb-5">
                        <a href="https://www.linkedin.com/in/vamsimarripudi/" target="_blank"><FaLinkedin size={40} className="text-white-600 mr-3"/></a>
                        <a href="https://github.com/vamsimarripudi" target="_blank"><FaGithub size={35} className="text-white-600 mr-3"/></a>
                        <a href="https://x.com/myselfvamsi27" target="_blank"><BsTwitterX size={32} className="text-white-600 "/></a>
                    </div>
                    <div>
								<strong>Open to:</strong>
								<ul className="list-none flex items-center  mt-2">
									<li className="list-item m-1 text-sm md:text-lg rounded-full border-1 pl-3 pr-3">Remote roles</li>
									<li className="list-item m-1 text-sm md:text-lg rounded-full border-1 pl-3 pr-3">Freelancing</li>
									<li className="list-item m-1  text-sm md:text-lg rounded-full border-1 pl-3 pr-3">Collaborations</li>
								</ul>
							</div>
                    
                </div>
                </div>
            </div> 
            <hr className="mx-6 border-1 h-70 mt-20 mb-20 hidden md:block"/>
            <div>
                <form className="max-w-md bg-gray-800 p-6 rounded-lg shadow-lg" onSubmit={handleSubmit}>
                    <div className=" flex  flex-row items-center mb-4">
                        <div>
                        <label className="block text-white mb-2" htmlFor="name">Name</label>
                        <input
                            type="text"
                            id="name"
                            placeholder="Enter Your Name"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.name}
                            onChange={(e) => {
                                setFormData({...formData,name:e.target.value}); 
                                setError("")} 
                            }
                        />
                        </div>
                        <div className="ml-4">
                        <label className="block text-white mb-2" htmlFor="email">Email</label>
                        <input
                            type="email"    
                            id="email"
                            placeholder="Enter Your Email"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.email}
                            onChange={(e) => {
                                setFormData({...formData, email: e.target.value});
                                setError("")}
                            }
                        />
                        </div>
                    </div>
                    <div className=" flex  flex-row items-center mb-4 gap-4">
                        <div>
                            <label className="block text-white mb-2" htmlFor="websiteType">Type of Website</label>
                            <select onClick={(e) => {
                                setFormData({...formData,siteType:e.target.value});
                                setError("")}
                            } 
                            className="w-full px-3 py-2 bg-gray-800 border border-black-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="" default>Select an option</option>
                                <option value="business">Business Website</option>
                                <option value="ecommerce">E-commerce Website</option>
                                <option value="portfolio">Portfolio Website</option>
                                <option value="static">Static Website</option>
                                <option value="responsive">Responsive Website</option>
                                <option value="webapp">Web Application</option>
                                <option value="dynamic">Dynamic Website</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-white mb-2" htmlFor="budget">Budget</label>
                            <input type="text" id="budget" placeholder="Enter Your Budget" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.budget}
                           
                            onChange={(e) => {
                                setFormData({...formData, budget: e.target.value});
                                setError("")}
                            }
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-white mb-2" htmlFor="description">Project Description</label>
                        <textarea
                            id="description"
                            placeholder="Describe your project..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                            value={formData.description}
                            onChange={handleDescriptionChange}
                        ></textarea>
                    </div>
                    <div className=" flex flex-row items-center justify-between mb-4">
                        <div style={{ display:"flex", justifyContent:"flex-start", color: remaining < 0 ? 'crimson' : 'var(--muted)' }}>{remaining} words left</div>
                        <div className="flex flex-row items-flex-end justify-end">
                    <button type="submit" className="bg-black-500 text-white px-4 py-2 border-1 rounded-md hover:bg-blue-600 transition-colors duration-300">Submit</button>
                    </div>
                    </div>
                    {error && <div style={{color:"red"}}>{error}</div>}
                    </form>
            </div>
             </div>
            </div>
        </>
    )
};  

export default Contact;