import { Star } from "lucide-react";

type RatingProps = {
  rating: number;
};

const Rating = ({
  rating,
}: RatingProps) => {
  return (
    <>
      {[1, 2, 3, 4, 5].map(
        (index: number) => (
          <Star
            key={index}
            color={
              index <= rating
                ? "#FFC107"
                : "#E4E5E9"
            }
            className="h-4 w-4"
          />
        )
      )}
    </>
  );
};

export default Rating;