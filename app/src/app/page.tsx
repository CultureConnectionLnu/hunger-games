import Image from "next/image";
// @ts-expect-error ci is complaining
import logo from "./_assets/logo.png";

export default async function Home() {
  return (
    <main className="flex min-h-screen flex-col  bg-gradient-to-t from-black to-orange-900">
      <div className="relative flex flex-col content-center items-center justify-center p-4">
        <div className="align-center flex h-64 w-64 rounded-full shadow-lg md:h-80 md:w-80 lg:h-96 lg:w-96">
          <Image
            src={logo}
            alt="logo"
            objectFit="cover"
            className="scale-200"
          />
        </div>
        <h1 className="mb-4 text-center text-2xl font-bold text-white">
          Culture Connection Hunger Games
        </h1>
        <p className="text-center text-white">
          Become a player if you are not one yet!
        </p>
        <p className="text-center text-white">
          Get in touch with one of the organizers or DM us on Instagram!
        </p>
        <p className="text-center font-bold text-white">
          @CultureConnectionLnu
        </p>
      </div>
    </main>
  );
}
