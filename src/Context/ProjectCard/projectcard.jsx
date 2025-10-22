import { Carousel } from "@material-tailwind/react";
 
export function CarouselDefault(img) {
  return (
    <Carousel className="rounded-xl">
      <img
      src={img}
        alt="image 1"
        className="h-full w-full object-cover"
      />
      <img
        src={img}
        alt="image 2"
        className="h-full w-full object-cover"
      />
      <img
        src={img}
        alt="image 3"
        className="h-full w-full object-cover"
      />
    </Carousel>
  );
}